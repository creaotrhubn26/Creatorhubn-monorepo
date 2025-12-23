import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Tooltip,
  Divider,
  Badge,
  Fab,
  SwipeableDrawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AISuggestionsToggle from '../settings/AISuggestionsToggle';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import {
  Menu as MenuIcon,
  ChevronLeft,
  ChevronRight,
  Videocam,
  Camera,
  Animation,
  Inventory,
  Landscape,
  ColorLens,
  PlayArrow,
  GetApp,
  Notifications,
  NotificationsActive,
  Lightbulb,
  Settings,
  AutoAwesome,
  Visibility as ViewfinderIcon,
  Category as CatalogIcon,
  Palette as PresetsIcon,
  History as HistoryIcon,
  AccountTree as HierarchyIcon,
  Undo,
  Redo,
  CompareArrows as CompareIcon,
  Movie as AnimateIcon,
  Assignment,
  PhotoLibrary,
  Fullscreen,
  FullscreenExit,
  Create as PencilIcon,
  TouchApp,
  Mouse,
  ViewSidebar,
  Timeline as TimelineIcon,
  LibraryBooks,
  Straighten,
  Extension,
  Tune,
  Person,
  Share,
  FileUpload,
  Brush,
  School,
  GridOn,
  Layers,
  RemoveRedEye,
  Visibility,
  Accessibility,
  School,
  Face,
  Monitor,
} from '@mui/icons-material';

// Logger
import { logger } from './src/core/services/logger';
const log = logger.module('VirtualStudio');

// Initialize design system
import { initializeDesignSystem } from './src/styles/globalStyles';
import { keyboardShortcutsService } from './src/core/services/keyboardShortcuts';

// Import all Virtual Studio panels
import Stage3D from './src/ui/stage3d/Stage3D';
import EnhancedStage3D from './src/ui/stage3d/EnhancedStage3D';
import { TimelinePanel } from './src/ui/panels/TimelinePanel';
import { CameraPathRecorder } from './src/ui/panels/CameraPathRecorder';
import { CurveEditor } from './src/ui/panels/CurveEditor';
import { CameraPanel } from './src/ui/panels/CameraPanel';
import { LightMeterOverlay } from './src/ui/overlays/LightMeterOverlay';
import { EquipmentBrowser } from './src/ui/panels/EquipmentBrowser';
import { CostCalculator } from './src/ui/panels/CostCalculator';
import { HDRIEnvironmentLoader } from './src/ui/panels/HDRIEnvironmentLoader';
import { AreaLightPanel } from './src/components/panels/AreaLightPanel';
import { RenderingSettingsPanel } from './src/components/panels/RenderingSettingsPanel';
import { useAnimationStore } from './src/state/animationStore';
import { integrationService } from './src/services/integrations';
import { Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import {
  useVirtualStudioIntegration,
  exposeMasterIntegration,
} from './src/hooks/useVirtualStudioIntegration';
import { VirtualStudioOnboarding, OnboardingConfig } from './src/ui/onboarding/VirtualStudioOnboarding';
import { FaceAnalysisProvider } from './src/contexts/FaceAnalysisContext';
import { VirtualStudioProvider, useVirtualStudio } from './VirtualStudioContext';
import { SchoolPhotographySetupDialog, SchoolSetupConfig } from './src/ui/components/SchoolPhotographySetupDialog';
import { ContinueSessionDialog, SessionSummary, SavedProject } from './src/ui/components/ContinueSessionDialog';
import { sessionTrackingService } from './src/core/services/sessionTrackingService';
import ToastDesigner from '../admin/visual-editor/ToastDesigner';
import { LightLensIntegrationPanel } from './src/ui/panels/LightLensIntegrationPanel';
import ViewfinderView, { ViewfinderPanel } from './src/ui/features/ViewfinderView';
import FlashControllerPanel from './src/ui/panels/FlashControllerPanel';
import { EquipmentCatalog, EquipmentItem } from './src/ui/panels/EquipmentCatalog';
import { ScenePresets, ScenePreset } from './src/ui/panels/ScenePresets';
import { equipmentIntegrationService } from './src/core/services/equipmentIntegrationService';
import { useKeyboardShortcuts, KeyboardShortcutsFloatingButton } from './src/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsPanel } from './src/ui/components/KeyboardShortcutsPanel';
import { undoRedoService } from './src/core/services/undoRedoService';
import { equipmentGroupingService } from './src/core/services/equipmentGroupingService';
import HistoryPanel from './src/ui/panels/HistoryPanel';
import EquipmentHierarchyPanel from './src/ui/panels/EquipmentHierarchyPanel';
import { SceneComparisonPanel, snapshotManager } from './src/ui/components/SceneComparison';
import { SceneAnimationPanel } from './src/ui/panels/SceneAnimationPanel';
import { QuickAccessToolbar, TransformMode } from './src/ui/components/QuickAccessToolbar';
import { selectionService } from './src/core/services/selectionService';
import { AnimationStudioPanel } from './src/ui/panels/AnimationStudioPanel';
import { animationRecorder } from './src/core/animation/AnimationRecorder';
import { animationTemplateService } from './src/core/animation/AnimationTemplates';
import { sceneAnimationService, AnimationTrack, AnimationClip } from './src/core/animation/SceneGraphAnimationEngine';
import { videoExportService, ExportResult } from './src/core/animation/VideoExportService';
import { animationStateManager } from './src/core/animation/AnimationStateManager';
import {
  ProjectManagerPanel,
  AutoSaveIndicator,
  VirtualStudioProject,
} from './src/ui/panels/ProjectManagerPanel';
import { ShotListIntegrationPanel, Shot } from './src/ui/panels/ShotListIntegrationPanel';
import { StoryboardPanel } from './src/ui/panels/StoryboardPanel';

// Additional panels
import { AssetLibraryPanel } from './src/ui/panels/AssetLibraryPanel';
import { BrandKitShowcase } from './src/ui/panels/BrandKitShowcase';
import { CharacterModelLoader } from './src/ui/panels/CharacterModelLoader';
import { ColorGrading } from './src/ui/panels/ColorGrading';
import { MeasurementsPanel } from './src/ui/panels/MeasurementsPanel';
import { ModifierBrowser } from './src/ui/panels/ModifierBrowser';
import { SceneTemplates } from './src/ui/panels/SceneTemplates';
import { ClientSharingPanel } from './src/ui/panels/ClientSharingPanel';
import { ImportDialog } from './src/ui/dialogs/ImportDialog';
import { errorHandler } from './src/core/services/errorHandler';

// Training & Guides
import { PhotographyTrainingPanel } from './src/ui/panels/PhotographyTrainingPanel';
import { StudioGuidesPanel } from './src/ui/panels/StudioGuidesPanel';
import { AdvancedGuidesPanel, AdvancedGuideSettings } from './src/ui/panels/AdvancedGuidesPanel';
import { useStudioGuideSettings, useShowStudioGuides, useAdvancedGuideSettings, useActions, useNodes } from './src/state/selectors';

// Advanced Visual Guides
import { CompositionOverlays, CompositionGuideType } from './src/ui/components/CompositionOverlays';
import { VideoProductionGuides, AspectRatioType } from './src/ui/components/VideoProductionGuides';
import { ColorExposureOverlay } from './src/ui/components/ColorExposureGuides';
import { GlassesReflectionGuide, GlassesReflectionPanel } from './src/ui/components/GlassesReflectionGuide';
import { CatchlightPanel, CatchlightSettings } from './src/ui/panels/CatchlightPanel';
import { FaceAnalysisPanel } from './src/ui/components/FaceAnalysisPanel';
import { ObjectExtractionPanel } from './src/ui/components/ObjectExtractionPanel';
import { SceneCompositionAnalyzer } from './src/ui/components/SceneCompositionAnalyzer';
import { DepthAnalysisPanel } from './src/ui/components/DepthAnalysisPanel';
import { MultiSubjectAnalyzer } from './src/ui/components/MultiSubjectAnalyzer';
import { PoseDetectionPanel } from './src/ui/components/PoseDetectionPanel';
import { PoseRecommendationPanel } from './src/ui/components/PoseRecommendationPanel';
import { LightingQualityAnalyzer } from './src/ui/components/LightingQualityAnalyzer';
import { ShadowAnalysisPanel } from './src/ui/components/ShadowAnalysisPanel';
import { LiveCompositionFeedback } from './src/ui/components/LiveCompositionFeedback';
import { ExposureColorAnalyzer } from './src/ui/components/ExposureColorAnalyzer';
import { AutoSceneOptimizer } from './src/ui/components/AutoSceneOptimizer';
import { BackgroundAnalyzer } from './src/ui/components/BackgroundAnalyzer';
import { AIShotSuggestions } from './src/ui/components/AIShotSuggestions';
import { BodyAnimationPanel } from './src/ui/panels/BodyAnimationPanel';
import { HandGesture, HEAD_PRESETS, HAND_PRESETS, FULL_BODY_POSES, BODY_ANIMATION_PRESETS } from './src/core/animations/BodyAnimations';
import { ClassPhotoPanel } from './src/ui/panels/ClassPhotoPanel';
import { ClassPhotoView } from './src/ui/components/ClassPhotoView';
import { classPhotoService, ClassPhotoSession } from './src/core/services/classPhotoService';
import { ClassPhotoGuideSettings } from './src/ui/panels/ClassPhotoPanel';
import { FacialFeaturesPanel } from './src/ui/panels/FacialFeaturesPanel';
import { 
  createFacialHairModel, 
  FacialHairOptions,
  MakeupOptions,
  SkinDetailOptions 
} from './src/core/models/FacialFeaturesModel';
import { MonitorFeedPanel } from './src/ui/panels/MonitorFeedPanel';
import { DirectorMonitor3D } from './src/ui/components/DirectorMonitor3D';
import { DirectorModeOverlay } from './src/ui/components/DirectorModeOverlay';
import { monitorFeedService, MonitorLayout } from './src/core/services/monitorFeedService';
import { directorModeService, DirectorModeState } from './src/core/services/directorModeService';

// Environment Service
import { environmentService, useEnvironment } from './src/core/services/environmentService';

// Tablet Support
import {
  TabletSupportProvider,
  useTabletSupport,
} from './src/providers/TabletSupportProvider';
import {
  TabletToolbar,
  TabletBottomSheet,
  TabletIconButton,
  GestureView,
} from './src/ui/components/TabletUI';

// Accessibility (WCAG 2.2)
import {
  AccessibilityProvider,
  useAccessibility,
  useKeyboardShortcut as useA11yShortcut,
} from './src/providers/AccessibilityProvider';
import { Accessible3DControls } from './src/ui/components/Accessible3DControls';
import PrototypeFeedbackTool from '../feedback/PrototypeFeedbackTool';

const DRAWER_WIDTH = 400;
const TIMELINE_HEIGHT = 400;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      style={{ height: '100%', overflow: 'auto' }}
      {...other}
    >
      {value === index && <Box sx={{ p: 2, height: '100%' }}>{children}</Box>}
    </div>
  );
}

const VirtualStudioInner: React.FC = () => {
  const { addToast } = useVirtualStudio();
  const theme = useTheme();
  
  // Tablet support
  const {
    isTablet,
    isMobile,
    isDesktop,
    isIPad,
    interactionMode,
    isPencilConnected,
    isPencilActive,
    gestureConfig,
    isFullscreenMode,
    setFullscreenMode,
  } = useTabletSupport();

  // Accessibility (WCAG 2.2)
  const { prefersKeyboard, announce, settings: a11ySettings } = useAccessibility();
  
  // Studio Guides from store
  const guideSettings = useStudioGuideSettings();
  const showStudioGuides = useShowStudioGuides();
  const advancedGuideSettings = useAdvancedGuideSettings();
  const { 
    toggleStudioGuides, 
    updateStudioGuideSettings, 
    updateAdvancedGuideSettings,
    addNode,
    updateNode,
    deleteNode,
  } = useActions();
  const nodes = useNodes();

  // Environment Service
  const {
    profession,
    specialization,
    environment: currentEnvironment,
    isLoaded: environmentLoaded,
    setEnvironment,
    applyToScene: applyEnvironmentToScene,
  } = useEnvironment();

  // Responsive drawer state - default closed on tablet/mobile
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(!isTablet && !isMobile);
  const [bottomDrawerOpen, setBottomDrawerOpen] = useState(!isMobile);
  const [activeTab, setActiveTab] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false); // Will be set after session check
  const [showSchoolPhotoSetup, setShowSchoolPhotoSetup] = useState(false);
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [previousSession, setPreviousSession] = useState<SessionSummary | null>(null);
  const [previousProjects, setPreviousProjects] = useState<SavedProject[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  
  // Body animation state
  const [bodyAnimationEnabled, setBodyAnimationEnabled] = useState(false);
  const [bodyHeadPreset, setBodyHeadPreset] = useState<keyof typeof HEAD_PRESETS>('forward');
  const [bodyHandPreset, setBodyHandPreset] = useState<keyof typeof HAND_PRESETS>('atSide');
  const [bodyGesture, setBodyGesture] = useState<HandGesture>('relaxed');
  const [bodyFullPose, setBodyFullPose] = useState<keyof typeof FULL_BODY_POSES>('neutral');
  const [bodyAnimPreset, setBodyAnimPreset] = useState<keyof typeof BODY_ANIMATION_PRESETS>('portrait');
  
  // Class Photo State
  const [classPhotoSession, setClassPhotoSession] = useState<ClassPhotoSession | null>(null);
  const [selectedClassPhotoStudent, setSelectedClassPhotoStudent] = useState<string | null>(null);
  const [showClassPhotoMode, setShowClassPhotoMode] = useState(false);
  const [classPhotoGuideSettings, setClassPhotoGuideSettings] = useState<ClassPhotoGuideSettings>({
    showHeadLines: true,
    showFOV: true,
    showEdgeWarnings: true,
    showSpacingRulers: true,
    showCenterLine: true,
    showHeightGaps: false,
    showEyeLine: false,
    showDOFPreview: false,
    showAspectRatioFrame: false,
    aspectRatio: '4x6',
  });
  
  // Tablet-specific panel states
  const [tabletPanelOpen, setTabletPanelOpen] = useState<'left' | 'bottom' | null>(null);
  
  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const userId = user?.id || user?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(userId);
  
  // Error handler listener for toasts
  useEffect(() => {
    const handleErrorToast = (e: CustomEvent) => {
      const { message, type, duration } = e.detail;
      addToast({ message, type, duration });
    };
    
    window.addEventListener('vs-error-toast,', handleErrorToast as EventListener);
    return () => {
      window.removeEventListener('vs-error-toast,', handleErrorToast as EventListener);
    };
  }, [addToast]);

  // HDRI sun light state (synced from HDRIEnvironmentLoader)
  const [sunLightSettings, setSunLightSettings] = useState<{
    position: [number, number, number];
    intensity: number;
    enabled: boolean;
  } | null>(null);

  // Listen for sun light updates from HDRIEnvironmentLoader
  useEffect(() => {
    const handleSunLightUpdate = (e: CustomEvent) => {
      const { position, intensity, enabled } = e.detail;
      setSunLightSettings({ position, intensity, enabled });
      
      // Could also add to scene nodes for undo/redo:
      // addNode({ type: 'light', subtype: 'sun', ... })
    };
    
    window.addEventListener('vs-sun-light-update', handleSunLightUpdate as EventListener);
    return () => {
      window.removeEventListener('vs-sun-light-update', handleSunLightUpdate as EventListener);
    };
  }, []);

  // Check for previous session and projects on mount
  useEffect(() => {
    const checkPreviousSessionAndProjects = async () => {
      setIsLoadingSession(true);
      setIsLoadingProjects(true);
      
      try {
        // Fetch previous projects
        const projectsPromise = fetchPreviousProjects();
        
        // Check for unsaved session
        const hasPrevious = await sessionTrackingService.hasPreviousSession();
        let summary: SessionSummary | null = null;
        
        if (hasPrevious) {
          summary = await sessionTrackingService.getSessionSummary();
          if (summary && summary.activities.length > 0) {
            setPreviousSession(summary);
          }
        }
        
        // Wait for projects to load
        const projects = await projectsPromise;
        setPreviousProjects(projects);
        setIsLoadingProjects(false);
        
        // Show continue dialog if we have a session or projects
        if ((summary && summary.activities.length > 0) || projects.length > 0) {
          setShowContinueDialog(true);
        } else {
          // No previous session or projects, show onboarding
          setShowOnboarding(true);
        }
      } catch (error) {
        log.error('Failed to check previous session: ', error);
        setShowOnboarding(true);
      } finally {
        setIsLoadingSession(false);
        setIsLoadingProjects(false);
      }
    };
    
    checkPreviousSessionAndProjects();
    
    // Initialize session tracking
    sessionTrackingService.initialize();
    
    return () => {
      sessionTrackingService.cleanup();
    };
  }, []);

  // Fetch previous projects from API
  const fetchPreviousProjects = async (): Promise<SavedProject[]> => {
    try {
      const response = await fetch('/api/virtual-studio/projects', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.projects && Array.isArray(data.projects)) {
          return data.projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            thumbnail: p.thumbnail_url,
            projectType: p.project_type || 'photography',
            specialization: p.settings?.specialization,
            status: p.status || 'draft',
            sceneCount: p.scene_count || 0,
            renderCount: p.render_count || 0,
            exportCount: p.export_count || 0,
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at),
            lastOpenedAt: p.last_opened_at ? new Date(p.last_opened_at) : undefined,
            isSynced: !!p.google_drive_folder_id,
            googleDriveFolderId: p.google_drive_folder_id,
            isFavorite: p.is_favorite || false,
          }));
        }
      }
    } catch (error) {
      log.warn('Failed to fetch previous projects:', error);
    }
    return [];
  };

  // Class Photo Scene Integration
  useEffect(() => {
    const handleClassPhotoActors = (event: CustomEvent) => {
      const { actors, props, camera, backdrop } = event.detail;
      
      // Add actor nodes to scene
      actors.forEach((actorNode: any) => {
        // Check if node already exists
        const existingNode = nodes.find(n => n.id === actorNode.id);
        if (existingNode) {
          updateNode(actorNode.id, actorNode);
        } else {
          addNode(actorNode);
        }
      });
      
      // Add prop nodes
      props.forEach((propNode: any) => {
        const existingNode = nodes.find(n => n.id === propNode.id);
        if (existingNode) {
          updateNode(propNode.id, propNode);
        } else {
          addNode(propNode);
        }
      });
      
      log.debug(`ClassPhoto: Added ${actors.length} actors and ${props.length} props to scene`);
    };
    
    const handleClassPhotoClear = (event: CustomEvent) => {
      const { actorIds, propIds } = event.detail;
      
      // Remove actor nodes
      actorIds.forEach((id: string) => {
        deleteNode(id);
      });
      
      // Remove prop nodes  
      propIds.forEach((id: string) => {
        deleteNode(id);
      });
      
      log.debug(`ClassPhoto: Cleared ${actorIds.length} actors and ${propIds.length} props`);
    };
    
    const handleActorRemove = (event: CustomEvent) => {
      const { id } = event.detail;
      deleteNode(id);
    };
    
    const handleClassPhotoHDRI = (event: CustomEvent) => {
      const { hdriId, url, intensity, rotation } = event.detail;
      
      // Dispatch HDRI update event for HDRIEnvironmentLoader
      const hdriEvent = new CustomEvent('vs-load-hdri', {
        detail: { 
          id: hdriId,
          url,
          intensity,
          rotation,
          source: 'classPhoto',
        },
      });
      window.dispatchEvent(hdriEvent);
      
      log.debug(`ClassPhoto: Loading HDRI: ${hdriId}`);
    };
    
    window.addEventListener('vs-class-photo-actors', handleClassPhotoActors as EventListener);
    window.addEventListener('vs-class-photo-clear', handleClassPhotoClear as EventListener);
    window.addEventListener('vs-class-photo-actor-remove', handleActorRemove as EventListener);
    window.addEventListener('vs-class-photo-hdri', handleClassPhotoHDRI as EventListener);
    
    return () => {
      window.removeEventListener('vs-class-photo-actors', handleClassPhotoActors as EventListener);
      window.removeEventListener('vs-class-photo-clear', handleClassPhotoClear as EventListener);
      window.removeEventListener('vs-class-photo-actor-remove', handleActorRemove as EventListener);
      window.removeEventListener('vs-class-photo-hdri', handleClassPhotoHDRI as EventListener);
    };
  }, [nodes, addNode, updateNode, deleteNode]);

  // ============================================================================
  // Facial Features Event Listeners
  // ============================================================================
  useEffect(() => {
    const handleActorExpression = (e: CustomEvent) => {
      const { expression, blendShapes } = e.detail;
      log.debug('Actor expression changed:', expression);
      // Update selected actor's expression blend shapes
      const selectedNode = nodes.find(n => n.selected && n.type === 'model');
      if (selectedNode) {
        updateNode(selectedNode.id, {
          userData: {
            ...selectedNode.userData,
            expression,
            blendShapes,
          },
        });
      }
      addToast({ message: `Expression: ${expression}`, type: 'info', duration: 2000 });
    };

    const handleActorFacialHair = (e: CustomEvent) => {
      const { options } = e.detail;
      log.debug('Facial hair changed:', options.style);
      const selectedNode = nodes.find(n => n.selected && n.type === 'model');
      if (selectedNode) {
        updateNode(selectedNode.id, {
          userData: {
            ...selectedNode.userData,
            facialHair: options,
          },
        });
      }
      addToast({ message: `Facial, hair: ${options.style}`, type: 'info', duration: 2000 });
    };

    const handleActorMakeup = (e: CustomEvent) => {
      const { preset, items } = e.detail;
      log.debug('Makeup changed:', preset);
      const selectedNode = nodes.find(n => n.selected && n.type === 'model');
      if (selectedNode) {
        updateNode(selectedNode.id, {
          userData: {
            ...selectedNode.userData,
            makeup: { preset, items },
          },
        });
      }
      addToast({ message: `Makeup: ${preset}`, type: 'info', duration: 2000 });
    };

    const handleActorSkinDetails = (e: CustomEvent) => {
      const options = e.detail;
      log.debug('Skin details changed:', options);
      const selectedNode = nodes.find(n => n.selected && n.type === 'model');
      if (selectedNode) {
        updateNode(selectedNode.id, {
          userData: {
            ...selectedNode.userData,
            skinDetails: options,
          },
        });
      }
    };

    const handleApplyPose = (e: CustomEvent) => {
      const { poseId, pose } = e.detail;
      log.debug('Applying pose:', poseId);
      const selectedNode = nodes.find(n => n.selected && n.type === 'model');
      if (selectedNode) {
        updateNode(selectedNode.id, {
          userData: {
            ...selectedNode.userData,
            pose: { id: poseId, data: pose },
          },
        });
      }
      addToast({ message: `Pose: ${pose?.name || poseId}`, type: 'info', duration: 2000 });
    };

    window.addEventListener('vs-actor-expression', handleActorExpression as EventListener);
    window.addEventListener('vs-actor-facial-hair', handleActorFacialHair as EventListener);
    window.addEventListener('vs-actor-makeup', handleActorMakeup as EventListener);
    window.addEventListener('vs-actor-skin-details', handleActorSkinDetails as EventListener);
    window.addEventListener('vs-apply-pose', handleApplyPose as EventListener);

    return () => {
      window.removeEventListener('vs-actor-expression', handleActorExpression as EventListener);
      window.removeEventListener('vs-actor-facial-hair', handleActorFacialHair as EventListener);
      window.removeEventListener('vs-actor-makeup', handleActorMakeup as EventListener);
      window.removeEventListener('vs-actor-skin-details', handleActorSkinDetails as EventListener);
      window.removeEventListener('vs-apply-pose', handleApplyPose as EventListener);
    };
  }, [nodes, updateNode, addToast]);

  // ============================================================================
  // Global Event Listeners - Handle all VS and CH events
  // ============================================================================
  useEffect(() => {
    // --- Lighting Pattern Events ---
    const handleApplyLightingPattern = (e: CustomEvent) => {
      const { pattern, lights } = e.detail;
      log.debug('Applying lighting pattern:', pattern?.name);
      
      // Add lights from pattern to scene
      if (lights && Array.isArray(lights)) {
        lights.forEach((light: any, index: number) => {
          const nodeId = `pattern_light_${Date.now()}_${index}`;
          addNode({
            id: nodeId,
            type: 'light',
            name: light.role || `Light ${index + 1}`,
            position: light.position || [0, 2, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            ...light,
          });
        });
      }
      addToast({ message: `Applied, pattern: ${pattern?.name || 'Unknown'}`, type: 'success' });
    };

    // --- Camera Events ---
    const handleCameraReset = (e: CustomEvent) => {
      log.debug('Camera reset');
      setA11yCameraState({
        position: [0, 1.5, 5],
        target: [0, 1, 0],
        zoom: 1,
        fov: 50,
      });
      addToast({ message: 'Camera reset to default', type: 'info' });
    };

    const handleCameraUpdate = (e: CustomEvent) => {
      const { position, target, zoom, fov } = e.detail;
      setA11yCameraState(prev => ({
        ...prev,
        ...(position && { position }),
        ...(target && { target }),
        ...(zoom !== undefined && { zoom }),
        ...(fov !== undefined && { fov }),
      }));
    };

    const handleCameraZoom = (e: CustomEvent) => {
      const { zoom, delta } = e.detail;
      setA11yCameraState(prev => ({
        ...prev,
        zoom: zoom ?? (prev.zoom + (delta || 0)),
      }));
    };

    const handleSetCamera = (e: CustomEvent) => {
      const { position, target, fov } = e.detail;
      log.debug('Setting camera position');
      setA11yCameraState(prev => ({
        ...prev,
        ...(position && { position }),
        ...(target && { target }),
        ...(fov !== undefined && { fov }),
      }));
    };

    // --- Scene Events ---
    const handleClearScene = (e: CustomEvent) => {
      log.debug('Clearing scene');
      const { preserveCamera, preserveLights } = e.detail || {};
      
      nodes.forEach((node: any) => {
        if (preserveCamera && node.type === 'camera') return;
        if (preserveLights && node.type === 'light') return;
        deleteNode(node.id);
      });
      
      addToast({ message: 'Scene cleared', type: 'info' });
    };

    const handleDeleteNode = (e: CustomEvent) => {
      const { id, ids } = e.detail;
      if (id) {
        deleteNode(id);
      }
      if (ids && Array.isArray(ids)) {
        ids.forEach((nodeId: string) => deleteNode(nodeId));
      }
    };

    // --- Object Events ---
    const handleObjectSelect = (e: CustomEvent) => {
      const { id } = e.detail;
      setA11ySelectedObjectId(id);
    };

    const handleObjectTransform = (e: CustomEvent) => {
      const { id, position, rotation, scale, transform } = e.detail;
      if (id) {
        const updates: any = {};
        if (position) updates.position = position;
        if (rotation) updates.rotation = rotation;
        if (scale) updates.scale = scale;
        if (transform) Object.assign(updates, transform);
        updateNode(id, updates);
      }
    };

    // --- HDRI Events ---
    const handleLoadHDRI = (e: CustomEvent) => {
      const { id, url, intensity, rotation } = e.detail;
      log.debug('Loading HDRI:', id);
      // Forward to HDRIEnvironmentLoader via another event or state
      window.dispatchEvent(new CustomEvent('vs-hdri-apply', { detail: e.detail }));
    };

    const handleHDRIExposureUpdate = (e: CustomEvent) => {
      const { exposure, intensity } = e.detail;
      log.debug('HDRI exposure update:', exposure || intensity);
      // This can update global exposure settings
    };

    // --- Lens Events ---
    const handleLensAttached = (e: CustomEvent) => {
      const { cameraId, lensId, lens } = e.detail;
      log.debug('Lens attached:', lensId'to camera:', cameraId);
      addToast({ message: `Lens, attached: ${lens?.name || lensId}`, type: 'success' });
    };

    const handleLensDetached = (e: CustomEvent) => {
      const { cameraId, lensId } = e.detail;
      log.debug('Lens detached:', lensId'from camera:', cameraId);
      addToast({ message: 'Lens detached', type: 'info' });
    };

    // --- Prop/Backdrop Events ---
    const handleAddProp = (e: CustomEvent) => {
      const { prop, position, rotation, scale } = e.detail;
      log.debug('Adding prop:', prop?.name || prop?.id);
      
      const nodeId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      addNode({
        id: nodeId,
        type: 'prop',
        name: prop?.name || 'Prop',
        position: position || [0, 0, 0],
        rotation: rotation || [0, 0, 0],
        scale: scale || [1, 1, 1],
        ...prop,
      });
      addToast({ message: `Added, prop: ${prop?.name || 'Prop'}`, type: 'success' });
    };

    const handleLoadBackdrop = (e: CustomEvent) => {
      const { backdrop, type, color, texture } = e.detail;
      log.debug('Loading backdrop:', backdrop?.name || type);
      
      // Remove existing backdrop if any
      const existingBackdrop = nodes.find((n: any) => n.type === 'backdrop');
      if (existingBackdrop) {
        deleteNode(existingBackdrop.id);
      }
      
      // Add new backdrop
      const nodeId = `backdrop_${Date.now()}`;
      addNode({
        id: nodeId,
        type: 'backdrop',
        name: backdrop?.name || type || 'Backdrop',
        position: [0, 0, -5],
        rotation: [0, 0, 0],
        scale: [10, 10, 1],
        color,
        texture,
        ...backdrop,
      });
      addToast({ message: `Loaded, backdrop: ${backdrop?.name || type}`, type: 'success' });
    };

    // --- Lighting Preset Events ---
    const handleLoadLightingPreset = (e: CustomEvent) => {
      const { preset, lights } = e.detail;
      log.debug('Loading lighting preset:', preset?.name);
      
      // Clear existing lights (optional based on preset settings)
      if (preset?.replaceExisting !== false) {
        nodes.forEach((n: any) => {
          if (n.type === 'light') deleteNode(n.id);
        });
      }
      
      // Add lights from preset
      if (lights && Array.isArray(lights)) {
        lights.forEach((light: any, index: number) => {
          const nodeId = `preset_light_${Date.now()}_${index}`;
          addNode({
            id: nodeId,
            type: 'light',
            name: light.name || `Light ${index + 1}`,
            position: light.position || [0, 2, 0],
            rotation: light.rotation || [0, 0, 0],
            scale: [1, 1, 1],
            ...light,
          });
        });
      }
      addToast({ message: `Loaded, preset: ${preset?.name || 'Lighting Preset'}`, type: 'success' });
    };

    // --- Character Recommended Light Setup Events ---
    const handleApplyLightSetup = (e: CustomEvent) => {
      const { id, name, lights, keyToFillRatio } = e.detail;
      log.debug('Applying recommended light setup:', name);
      
      // Clear existing lights
      nodes.forEach((n: any) => {
        if (n.type === 'light') deleteNode(n.id);
      });
      
      // Add lights from recommended setup
      if (lights && Array.isArray(lights)) {
        lights.forEach((light: any, index: number) => {
          const nodeId = `setup_light_${Date.now()}_${index}`;
          addNode({
            id: nodeId,
            type: 'light',
            name: light.name || `${light.type} Light`,
            transform: {
              position: [light.position.x, light.position.y, light.position.z],
              rotation: [light.rotation.x * Math.PI / 180, light.rotation.y * Math.PI / 180, light.rotation.z * Math.PI / 180],
              scale: [1, 1, 1],
            },
            visible: light.enabled,
            userData: {
              lightType: light.type,
              power: light.power,
              colorTemp: light.colorTemp,
              modifier: light.modifier,
              modifierSize: light.modifierSize,
            },
          });
        });
      }
      addToast({ 
        message: `Applied, lighting: ${name}${keyToFillRatio ? ` (${keyToFillRatio})` : ', '}`,
        type: 'success',
        duration: 3000,
      });
    };

    // --- PBR/Props Recommendation Events ---
    const handleAddPBRItem = (e: CustomEvent) => {
      const { id, name, type, category, material, position, rotation, scale } = e.detail;
      log.debug('Adding PBR item:', name);
      
      const nodeId = `pbr_${type}_${Date.now()}`;
      const nodeType = type === 'backdrop' ? 'backdrop' : type === 'floor' ? 'floor' : 'prop';
      
      addNode({
        id: nodeId,
        type: nodeType,
        name: name,
        transform: {
          position: position ? [position.x, position.y, position.z] : [0, 0, 0],
          rotation: rotation ? [rotation.x * Math.PI / 180, rotation.y * Math.PI / 180, rotation.z * Math.PI / 180] : [0, 0, 0],
          scale: scale ? [scale.x, scale.y, scale.z] : [1, 1, 1],
        },
        visible: true,
        userData: {
          pbrCategory: category,
          pbrType: type,
          material: material ? {
            color: material.color,
            roughness: material.roughness,
            metalness: material.metalness,
            texture: material.texture,
          } : undefined,
        },
      });
    };

    // --- Guide Events ---
    const handleAdvancedGuidesChanged = (e: CustomEvent) => {
      const settings = e.detail;
      log.debug('Advanced guides changed');
      updateAdvancedGuideSettings(settings);
    };

    const handleGuideSettingsChanged = (e: CustomEvent) => {
      const settings = e.detail;
      log.debug('Guide settings changed');
      updateStudioGuideSettings(settings);
    };

    // --- Environment Events ---
    const handleEnvironmentChanged = (e: CustomEvent) => {
      const { environment, preset } = e.detail;
      log.debug('Environment changed:', environment || preset);
      // Environment changes are handled by EnvironmentService
    };
    
    // --- School Photography Events ---
    const handleOpenSchoolSetup = () => {
      log.debug('Opening school photography setup dialog');
      setShowSchoolPhotoSetup(true);
    };

    // --- Equipment Events ---
    const handleHighlightEquipment = (e: CustomEvent) => {
      const { id, highlight } = e.detail;
      log.debug('Highlighting equipment:', id);
      // Can update selection or add visual highlight
      if (highlight !== false) {
        setA11ySelectedObjectId(id);
      }
    };

    // --- Photogrammetry/Neural Events ---
    const handlePhotogrammetryProgress = (e: CustomEvent) => {
      const { progress, stage, status } = e.detail;
      log.debug('Photogrammetry progress:', progress, stage);
      // Could show progress in UI
    };

    const handleNeRFProgress = (e: CustomEvent) => {
      const { progress, stage, status } = e.detail;
      log.debug('NeRF capture progress:', progress, stage);
    };

    // Register all event listeners
    window.addEventListener('ch-apply-lighting-pattern', handleApplyLightingPattern as EventListener);
    window.addEventListener('ch-camera-reset', handleCameraReset as EventListener);
    window.addEventListener('ch-camera-update', handleCameraUpdate as EventListener);
    window.addEventListener('ch-camera-zoom', handleCameraZoom as EventListener);
    window.addEventListener('ch-clear-scene', handleClearScene as EventListener);
    window.addEventListener('ch-delete-node', handleDeleteNode as EventListener);
    window.addEventListener('ch-hdri-exposure-update', handleHDRIExposureUpdate as EventListener);
    window.addEventListener('ch-lens-attached', handleLensAttached as EventListener);
    window.addEventListener('ch-lens-detached', handleLensDetached as EventListener);
    window.addEventListener('ch-object-select', handleObjectSelect as EventListener);
    window.addEventListener('ch-object-transform', handleObjectTransform as EventListener);
    window.addEventListener('vs-add-pbr-item', handleAddPBRItem as EventListener);
    window.addEventListener('vs-add-prop', handleAddProp as EventListener);
    window.addEventListener('vs-advanced-guides-changed', handleAdvancedGuidesChanged as EventListener);
    window.addEventListener('vs-apply-light-setup', handleApplyLightSetup as EventListener);
    window.addEventListener('vs-environment-changed', handleEnvironmentChanged as EventListener);
    window.addEventListener('vs-open-school-setup', handleOpenSchoolSetup as EventListener);
    window.addEventListener('vs-guide-settings-changed', handleGuideSettingsChanged as EventListener);
    window.addEventListener('vs-highlight-equipment', handleHighlightEquipment as EventListener);
    window.addEventListener('vs-load-backdrop', handleLoadBackdrop as EventListener);
    window.addEventListener('vs-load-hdri', handleLoadHDRI as EventListener);
    window.addEventListener('vs-load-lighting-preset', handleLoadLightingPreset as EventListener);
    window.addEventListener('vs-set-camera', handleSetCamera as EventListener);
    window.addEventListener('photogrammetry-progress', handlePhotogrammetryProgress as EventListener);
    window.addEventListener('nerf-capture-progress', handleNeRFProgress as EventListener);

    return () => {
      window.removeEventListener('ch-apply-lighting-pattern', handleApplyLightingPattern as EventListener);
      window.removeEventListener('ch-camera-reset', handleCameraReset as EventListener);
      window.removeEventListener('ch-camera-update', handleCameraUpdate as EventListener);
      window.removeEventListener('ch-camera-zoom', handleCameraZoom as EventListener);
      window.removeEventListener('ch-clear-scene', handleClearScene as EventListener);
      window.removeEventListener('ch-delete-node', handleDeleteNode as EventListener);
      window.removeEventListener('ch-hdri-exposure-update', handleHDRIExposureUpdate as EventListener);
      window.removeEventListener('ch-lens-attached', handleLensAttached as EventListener);
      window.removeEventListener('ch-lens-detached', handleLensDetached as EventListener);
      window.removeEventListener('ch-object-select', handleObjectSelect as EventListener);
      window.removeEventListener('ch-object-transform', handleObjectTransform as EventListener);
      window.removeEventListener('vs-add-pbr-item', handleAddPBRItem as EventListener);
      window.removeEventListener('vs-add-prop', handleAddProp as EventListener);
      window.removeEventListener('vs-advanced-guides-changed', handleAdvancedGuidesChanged as EventListener);
      window.removeEventListener('vs-apply-light-setup', handleApplyLightSetup as EventListener);
      window.removeEventListener('vs-environment-changed', handleEnvironmentChanged as EventListener);
      window.removeEventListener('vs-open-school-setup', handleOpenSchoolSetup as EventListener);
      window.removeEventListener('vs-guide-settings-changed', handleGuideSettingsChanged as EventListener);
      window.removeEventListener('vs-highlight-equipment', handleHighlightEquipment as EventListener);
      window.removeEventListener('vs-load-backdrop', handleLoadBackdrop as EventListener);
      window.removeEventListener('vs-load-hdri', handleLoadHDRI as EventListener);
      window.removeEventListener('vs-load-lighting-preset', handleLoadLightingPreset as EventListener);
      window.removeEventListener('vs-set-camera', handleSetCamera as EventListener);
      window.removeEventListener('photogrammetry-progress', handlePhotogrammetryProgress as EventListener);
      window.removeEventListener('nerf-capture-progress', handleNeRFProgress as EventListener);
    };
  }, [nodes, addNode, updateNode, deleteNode, addToast, updateStudioGuideSettings, updateAdvancedGuideSettings]);

  // Track scene changes for session persistence
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      sessionTrackingService.updateNodeCounts(nodes);
    }
  }, [nodes]);

  // Director Monitor event handlers
  useEffect(() => {
    const handleAddDirectorMonitor = (e: CustomEvent) => {
      const monitor = e.detail;
      if (monitor && monitor.id) {
        setDirectorMonitors(prev => [...prev, monitor]);
        log.info('Added director monitor:', monitor.id);
        addToast({
          message: `Director monitor "${monitor.name}," added`,
          type: 'success',
          duration: 2000,
        });
      }
    };

    window.addEventListener('vs-add-director-monitor', handleAddDirectorMonitor as EventListener);

    return () => {
      window.removeEventListener('vs-add-director-monitor', handleAddDirectorMonitor as EventListener);
    };
  }, [addToast]);
  
  // Director Mode subscription (zoom into monitor)
  useEffect(() => {
    const unsubscribe = directorModeService.subscribe((state) => {
      setDirectorModeState(state);
      
      if (state.isActive && !state.isAnimating) {
        addToast({
          message: 'Director Mode - Click outside or press ESC to exit',
          type: 'info',
          duration: 3000,
        });
      }
    });
    
    // Handle ESC key to exit director mode
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && directorModeState.isActive) {
        directorModeService.exitDirectorMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addToast, directorModeState.isActive]);
  
  // Exit director mode handler
  const handleExitDirectorMode = useCallback(() => {
    directorModeService.exitDirectorMode();
  }, []);
  
  // Director Mode camera control event listeners
  useEffect(() => {
    // Handle director mode entered
    const handleDirectorModeEntered = (e: CustomEvent) => {
      const { monitorId, monitorName } = e.detail;
      log.info('Director Mode entered:', monitorId);
    };
    
    // Handle director mode exited
    const handleDirectorModeExited = (e: CustomEvent) => {
      log.info('Director Mode exited');
    };
    
    // Handle multi-camera recording started
    const handleRecordingStarted = (e: CustomEvent) => {
      const { cameraCount } = e.detail;
      addToast({
        message: `Recording started on ${cameraCount} camera(s)`,
        type: 'success',
        duration: 3000,
      });
    };
    
    // Handle multi-camera recording stopped
    const handleRecordingStopped = (e: CustomEvent) => {
      const { recordings } = e.detail;
      addToast({
        message: `Recording complete! ${recordings?.length || 0} video(s) ready to download`,
        type: 'success',
        duration: 5000,
      });
    };
    
    window.addEventListener('vs-director-mode-entered', handleDirectorModeEntered as EventListener);
    window.addEventListener('vs-director-mode-exited', handleDirectorModeExited as EventListener);
    window.addEventListener('vs-multi-camera-recording-started', handleRecordingStarted as EventListener);
    window.addEventListener('vs-multi-camera-recording-stopped', handleRecordingStopped as EventListener);
    
    return () => {
      window.removeEventListener('vs-director-mode-entered', handleDirectorModeEntered as EventListener);
      window.removeEventListener('vs-director-mode-exited', handleDirectorModeExited as EventListener);
      window.removeEventListener('vs-multi-camera-recording-started', handleRecordingStarted as EventListener);
      window.removeEventListener('vs-multi-camera-recording-stopped', handleRecordingStopped as EventListener);
    };
  }, [addToast]);

  // Missing event listeners - Fixed in workflow check
  useEffect(() => {
    // vs-toast: Generic toast notifications from various panels
    const handleToast = (e: CustomEvent) => {
      const { message, severity, duration } = e.detail;
      addToast({ 
        message, 
        type: severity || 'info', 
        duration: duration || 3000 
      });
    };

    // vs-hdri-apply: Apply HDRI from recommendation dialogs
    const handleHDRIApply = (e: CustomEvent) => {
      const { id, url, intensity, rotation } = e.detail;
      log.debug('Applying HDRI:', id || url);
      // Dispatch to HDRIEnvironmentLoader
      window.dispatchEvent(new CustomEvent('vs-load-hdri', { 
        detail: { id, url, intensity, rotation } 
      }));
    };

    // vs-actor-entrance: Play entrance animation for newly added actors
    const handleActorEntrance = (e: CustomEvent) => {
      const { nodeId, genre, characterType } = e.detail;
      log.debug('Actor entrance:', nodeId, genre);
      // The animation is handled by AnimatedActorCard, but we can show a toast
      addToast({ 
        message: `Character, entered: ${characterType || 'Actor'}`,
        type: 'info', 
        duration: 2000 
      });
    };

    // vs-import-image: Handle image imports from dialog
    const handleImportImage = (e: CustomEvent) => {
      const { url, type } = e.detail;
      log.debug('Importing image:', url);
      
      // Add as backdrop or texture based on type
      const nodeId = `import_${Date.now()}`;
      if (type === 'hdri') {
        window.dispatchEvent(new CustomEvent('vs-load-hdri', { 
          detail: { url, intensity: 1.0 } 
        }));
      } else {
        // Add as backdrop texture
        addNode({
          id: nodeId,
          type: 'backdrop',
          name: 'Imported Image',
          position: [0, 0, -5],
          rotation: [0, 0, 0],
          scale: [10, 10, 1],
          texture: url,
        });
        addToast({ message: 'Image imported as backdrop', type: 'success' });
      }
    };

    // vs-selection: Sync selection state across panels
    const handleSelection = (e: CustomEvent) => {
      const { type, ids } = e.detail;
      log.debug('Selection changed:', type, ids);
      // Selection is already handled by selectionService, this is for UI sync
      if (ids && ids.length > 0) {
        // Could update focused node here if needed
      }
    };

    // vs-class-photo-actor-update: Update actor in class photo mode
    const handleClassPhotoActorUpdate = (e: CustomEvent) => {
      const { node } = e.detail;
      log.debug('Class photo actor update:', node?.id);
      if (node && node.id) {
        updateNode(node.id, node);
      }
    };

    window.addEventListener('vs-toast', handleToast as EventListener);
    window.addEventListener('vs-hdri-apply', handleHDRIApply as EventListener);
    window.addEventListener('vs-actor-entrance', handleActorEntrance as EventListener);
    window.addEventListener('vs-import-image', handleImportImage as EventListener);
    window.addEventListener('vs-selection', handleSelection as EventListener);
    window.addEventListener('vs-class-photo-actor-update', handleClassPhotoActorUpdate as EventListener);

    return () => {
      window.removeEventListener('vs-toast', handleToast as EventListener);
      window.removeEventListener('vs-hdri-apply', handleHDRIApply as EventListener);
      window.removeEventListener('vs-actor-entrance', handleActorEntrance as EventListener);
      window.removeEventListener('vs-import-image', handleImportImage as EventListener);
      window.removeEventListener('vs-selection', handleSelection as EventListener);
      window.removeEventListener('vs-class-photo-actor-update', handleClassPhotoActorUpdate as EventListener);
    };
  }, [addToast, addNode, updateNode]);

  // Rendering settings state
  const [pbrEnabled, setPbrEnabled] = useState(true);
  const [giEnabled, setGiEnabled] = useState(true);
  const [volumetricsEnabled, setVolumetricsEnabled] = useState(false);
  const [softShadowsEnabled, setSoftShadowsEnabled] = useState(true);
  const [vsmShadowsEnabled, setVsmShadowsEnabled] = useState(false);
  const [falseColorEnabled, setFalseColorEnabled] = useState(false);
  const [falseColorOpacity, setFalseColorOpacity] = useState(0.8);
  const [luminanceHeatmapEnabled, setLuminanceHeatmapEnabled] = useState(false);
  const [luminanceHeatmapMin, setLuminanceHeatmapMin] = useState(0.0);
  const [luminanceHeatmapMax, setLuminanceHeatmapMax] = useState(1.0);
  const [luminanceHeatmapOpacity, setLuminanceHeatmapOpacity] = useState(0.7);
  const [giIntensity, setGiIntensity] = useState(0.5);
  const [giBounces, setGiBounces] = useState(2);
  const [volumetricQuality, setVolumetricQuality] = useState<'fast' | 'quality'>('fast');
  
  // Enhanced renderer reference
  const enhancedRendererRef = useRef<any>(null);

  // Area lights state
  const [areaLights, setAreaLights] = useState<any[]>([]);

  // Enhanced rendering toggle
  const [useEnhancedRenderer, setUseEnhancedRenderer] = useState(true);

  // Transform mode for quick-access toolbar
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [showGrid, setShowGrid] = useState(true);

  // Animation Studio state
  const [animationTracks, setAnimationTracks] = useState<AnimationTrack[]>([]);
  const [animationClips, setAnimationClips] = useState<AnimationClip[]>([]);
  const [animationCurrentTime, setAnimationCurrentTime] = useState(0);
  const [animationIsPlaying, setAnimationIsPlaying] = useState(false);
  const [showMotionPaths, setShowMotionPaths] = useState(true);
  const [selectedAnimationNodeId, setSelectedAnimationNodeId] = useState<string | null>(null);

  // Scene nodes for animation (simplified representation)
  const [sceneNodes, setSceneNodes] = useState<Array<{ id: string; type: string; name?: string }>>([
    { id: 'mainCamera', type: 'camera', name: 'Main Camera' },
    { id: 'keyLight', type: 'light', name: 'Key Light' },
    { id: 'fillLight', type: 'light', name: 'Fill Light' },
    { id: 'rimLight', type: 'light', name: 'Rim Light' },
  ]);

  // Camera state for accessibility controls
  const [a11yCameraState, setA11yCameraState] = useState({
    position: [0, 1.5, 5] as [number, number, number],
    target: [0, 1, 0] as [number, number, number],
    zoom: 1,
    fov: 50,
  });

  // Selected object for accessibility navigation
  const [a11ySelectedObjectId, setA11ySelectedObjectId] = useState<string | null>(null);

  // Scene objects for accessibility navigation
  const a11ySceneObjects = sceneNodes.map((node, index) => ({
    id: node.id,
    name: node.name || `Object ${index + 1}`,
    type: node.type,
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    visible: true,
  }));

  // Handle accessibility camera changes
  const handleA11yCameraChange = useCallback((state: Partial<typeof a11yCameraState>) => {
    setA11yCameraState(prev => ({ ...prev, ...state }));
    window.dispatchEvent(new CustomEvent('ch-camera-update', { detail: state }));
    if (state.position) {
      announce(`Camera moved to ${state.position.map(v => v.toFixed(1)).join(', ')}`);
    }
    if (state.zoom) {
      announce(`Zoom: ${Math.round(state.zoom * 100)}%`);
    }
  }, [announce]);

  // Handle accessibility object selection
  const handleA11yObjectSelect = useCallback((id: string | null) => {
    setA11ySelectedObjectId(id);
    if (id) {
      const obj = a11ySceneObjects.find(o => o.id === id);
      if (obj) {
        announce(`Selected: ${obj.name}`);
        window.dispatchEvent(new CustomEvent('ch-object-select', { detail: { id } }));
      }
    } else {
      announce('Selection cleared');
    }
  }, [a11ySceneObjects, announce]);

  // Handle accessibility object transform
  const handleA11yObjectTransform = useCallback((id: string, transform: any) => {
    window.dispatchEvent(new CustomEvent('ch-object-transform', { 
      detail: { id, transform } 
    }));
    const obj = a11ySceneObjects.find(o => o.id === id);
    if (obj) {
      announce(`${obj.name} transformed`);
    }
  }, [a11ySceneObjects, announce]);

  // Project Management state
  const [currentProject, setCurrentProject] = useState<VirtualStudioProject | null>(null);

  // Director Monitor state
  const [directorMonitors, setDirectorMonitors] = useState<Array<{
    id: string;
    name: string;
    position: [number, number, number];
    layout: MonitorLayout;
    isActive: boolean;
  }>>([]);
  
  // Director Mode state (zoomed into monitor view)
  const [directorModeState, setDirectorModeState] = useState<DirectorModeState>({
    isActive: false,
    monitorId: null,
    monitorName: ', ',
    originalCameraPosition: null,
    originalCameraTarget: null,
    monitorPosition: null,
    isAnimating: false,
  });

  // Server-first onboarding state
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/kv/virtualStudio_onboardingCompleted', { credentials: 'include' });
        const j = res.ok ? await res.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        if (mounted) {
          if (v === 'true' || v === true) setShowOnboarding(false);
          else {
            const completed = localStorage.getItem('virtualStudio_onboardingCompleted');
            setShowOnboarding(completed !== 'true');
          }
        }
      } catch {
        const completed = localStorage.getItem('virtualStudio_onboardingCompleted');
        if (mounted) setShowOnboarding(completed !== 'true');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Use master integration for auth
  const { auth: masterAuth } = useEnhancedMasterIntegration();
  const user = masterAuth.state.user;

  const { tracks, isPlaying, isRecording } = useAnimationStore();

  // Connect to master integration and services
  const integration = useVirtualStudioIntegration({
    enableFlaskBackend: true,
    enableGoogleDrive: true,
    enableAnalytics: true,
    enableLUTLibrary: true,
    enableSVGRenderer: true,
    enableAIVision: true,
  });

  // Expose for debugging (use ref to prevent infinite loops)
  const integrationRef = useRef(integration);
  integrationRef.current = integration;
  useEffect(() => {
    exposeMasterIntegration(integrationRef.current);
  }, [integration.isInitialized]); // Only depend on isInitialized to prevent infinite loops

  // Track feature usage
  useEffect(() => {
    if (integration.isInitialized) {
      integration.backend.trackFeatureUsage('virtual-studio, ','opened');
    }
  }, [integration.isInitialized]);

  const handleOnboardingComplete = (config?: OnboardingConfig) => {
    setShowOnboarding(false);
    // Persist server-first
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'virtualStudio_onboardingCompleted', value: 'true' })
    }).catch(() => {});
    localStorage.setItem('virtualStudio_onboardingCompleted','true');
    // Track onboarding completion
    if (integration.isInitialized) {
      integration.backend.trackFeatureUsage('virtual-studio','onboarding-completed');
    }
    
    // Check if school photography was selected - show specialized setup dialog
    if (config?.specialization === 'school_photography') {
      // Short delay to let onboarding dialog close first
      setTimeout(() => {
        setShowSchoolPhotoSetup(true);
      }, 300);
      addToast({
        message: 'Welcome to Virtual Studio for School Photography!',
        type: 'success',
        duration: 4000,
      });
    } else {
      addToast({
        message: 'Welcome to Virtual Studio! All systems ready.',
        type: 'success',
        duration: 4000,
      });
    }
  };
  
  const handleSchoolSetupComplete = (config: SchoolSetupConfig) => {
    setShowSchoolPhotoSetup(false);
    log.info('School photography setup complete:', config);
    addToast({
      message: `${config.photoType.name} environment configured successfully!`,
      type: 'success',
      duration: 4000,
    });
  };

  // Continue Session Handlers
  const handleContinueSession = useCallback(() => {
    setShowContinueDialog(false);
    log.info('Continuing previous session');
    
    // Resume the session
    const session = sessionTrackingService.resumeSession();
    if (session) {
      // Restore scene state if available
      if (session.sceneSnapshot?.nodes?.length > 0) {
        // The scene will be restored from the session
        addToast({
          message: 'Welcome back! Your session has been restored.',
          type: 'success',
          duration: 4000,
        });
      }
    }
  }, [addToast]);

  const handleStartNewProject = useCallback(() => {
    setShowContinueDialog(false);
    setPreviousSession(null);
    
    // Clear previous session
    sessionTrackingService.clearSession();
    
    // Show onboarding for new project
    setShowOnboarding(true);
    
    log.info('Starting new project');
  }, []);

  const handleCloseContinueDialog = useCallback(() => {
    // If they close without choosing, continue with previous session if exists
    if (previousSession) {
      handleContinueSession();
    } else {
      setShowContinueDialog(false);
      setShowOnboarding(true);
    }
  }, [previousSession, handleContinueSession]);

  // Open a saved project
  const handleOpenProject = useCallback(async (project: SavedProject) => {
    setShowContinueDialog(false);
    log.info('Opening project:', project.name);
    
    try {
      // Fetch project details
      const response = await fetch(`/api/virtual-studio/projects/${project.id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Clear current session
        sessionTrackingService.clearSession();
        
        // Start new session with project context
        sessionTrackingService.startSession({
          name: project.name,
          projectId: project.id,
          profession: project.projectType === 'videography' ? 'videographer' : 'photographer',
          specialization: project.specialization,
        });
        
        // Load project scenes if available
        if (data.scenes && data.scenes.length > 0) {
          // Load the most recent scene
          const latestScene = data.scenes[0];
          if (latestScene.scene_data?.nodes) {
            // Dispatch event to load scene nodes
            window.dispatchEvent(new CustomEvent('vs-load-scene', {
              detail: { sceneData: latestScene.scene_data },
            }));
          }
        }
        
        addToast({
          message: `Opened, project: ${project.name}`,
          type: 'success',
          duration: 4000,
        });
        
        // Update last opened timestamp
        await fetch(`/api/virtual-studio/projects/${project.id}/opened`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {});
        
      } else {
        throw new Error('Failed to load project');
      }
    } catch (error) {
      log.error('Failed to open project:', error);
      addToast({
        message: 'Failed to open project',
        type: 'error',
        duration: 4000,
      });
    }
  }, [addToast]);

  // Delete a project
  const handleDeleteProject = useCallback(async (project: SavedProject) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/virtual-studio/projects/${project.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        setPreviousProjects(prev => prev.filter(p => p.id !== project.id));
        addToast({
          message: `Deleted, project: ${project.name}`,
          type: 'success',
          duration: 3000,
        });
      } else {
        throw new Error('Failed to delete project');
      }
    } catch (error) {
      log.error('Failed to delete project:', error);
      addToast({
        message: 'Failed to delete project',
        type: 'error',
        duration: 4000,
      });
    }
  }, [addToast]);

  // Duplicate a project
  const handleDuplicateProject = useCallback(async (project: SavedProject) => {
    try {
      const response = await fetch(`/api/virtual-studio/projects/${project.id}/duplicate`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const newProject: SavedProject = {
          ...project,
          id: data.project.id,
          name: `${project.name} (Copy)`,
          createdAt: new Date(),
          updatedAt: new Date(),
          isFavorite: false,
        };
        setPreviousProjects(prev => [newProject, ...prev]);
        addToast({
          message: `Duplicated, project: ${project.name}`,
          type: 'success',
          duration: 3000,
        });
      } else {
        throw new Error('Failed to duplicate project');
      }
    } catch (error) {
      log.error('Failed to duplicate project:', error);
      addToast({
        message: 'Failed to duplicate project',
        type: 'error',
        duration: 4000,
      });
    }
  }, [addToast]);

  // Toggle favorite status
  const handleToggleFavorite = useCallback(async (project: SavedProject) => {
    try {
      const response = await fetch(`/api/virtual-studio/projects/${project.id}/favorite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ isFavorite: !project.isFavorite }),
      });
      
      if (response.ok) {
        setPreviousProjects(prev => prev.map(p => 
          p.id === project.id ? { ...p, isFavorite: !p.isFavorite } : p
        ));
      }
    } catch (error) {
      log.warn('Failed to toggle favorite:', error);
    }
  }, []);

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    // Persist server-first
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'virtualStudio_onboardingCompleted', value: 'true' })
    }).catch(() => {});
    localStorage.setItem('virtualStudio_onboardingCompleted','true');
    // Track onboarding skip
    if (integration.isInitialized) {
      integration.backend.trackFeatureUsage('virtual-studio','onboarding-skipped');
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    const newValue = !isFullscreenMode;
    setFullscreenMode(newValue);
    
    if (newValue) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreenMode, setFullscreenMode]);

  // Get input mode display info
  const getInputModeInfo = () => {
    switch (interactionMode) {
      case 'pencil':
        return { icon: <PencilIcon sx={{ fontSize: 16 }} />, label: 'Apple Pencil', color: '#4CAF50' };
      case 'touch':
        return { icon: <TouchApp sx={{ fontSize: 16 }} />, label: 'Touch', color: '#2196F3' };
      default:
        return { icon: <Mouse sx={{ fontSize: 16 }} />, label: 'Mouse', color: 'rgba(255,255,255,0.7)' };
    }
  };

  const inputModeInfo = getInputModeInfo();

  // Close tablet panel when switching to desktop
  useEffect(() => {
    if (isDesktop) {
      setTabletPanelOpen(null);
    }
  }, [isDesktop]);

  // Project Management handlers
  const handleProjectLoad = (project: VirtualStudioProject) => {
    setCurrentProject(project);
    
    // Load scene data into store
    if (project.sceneData?.nodes) {
      // Dispatch event to load nodes into the scene
      window.dispatchEvent(
        new CustomEvent('ch-load-scene', { detail: { nodes: project.sceneData.nodes } })
      );
    }
    
    // Load animation data if present
    if (project.animationData?.tracks) {
      setAnimationTracks(project.animationData.tracks);
    }
    if (project.animationData?.clips) {
      setAnimationClips(project.animationData.clips);
    }
    
    addToast({
      message: `📁 Loaded project "${project.name}"`,
      type: 'success',
      duration: 3000,
    });
  };

  const handleProjectSave = (project: VirtualStudioProject) => {
    setCurrentProject(project);
    addToast({
      message: `💾 Project "${project.name}" saved`,
      type: 'success',
      duration: 2000,
    });
  };

  // Handler for adding equipment from catalog
  const handleAddEquipmentFromCatalog = (
    item: EquipmentItem,
    options: Record<string, any>,
    position?: [number, number, number]
  ) => {
    const node = equipmentIntegrationService.createSceneNode(
      item.modelFunction,
      options,
      item.name,
      position || [0, 0, 0]
    );
    equipmentIntegrationService.addToScene(node);
    addToast({
      message: `✨ Added ${item.name} to scene`,
      type: 'success',
      duration: 2000,
    });
  };

  // Handler for loading scene presets
  const handleLoadPreset = (preset: ScenePreset) => {
    equipmentIntegrationService.loadPreset(preset);
    addToast({
      message: `🎬 Loaded "${preset.name}" preset with ${preset.equipment.length} items`,
      type: 'success',
      duration: 3000,
    });
  };

  // Animation handlers
  const handleAnimationPlay = () => {
    setAnimationIsPlaying(true);
    addToast({ message: '▶️ Animation playing', type: 'info', duration: 1500 });
  };

  const handleAnimationPause = () => {
    setAnimationIsPlaying(false);
    addToast({ message: '⏸️ Animation paused', type: 'info', duration: 1500 });
  };

  const handleAnimationStop = () => {
    setAnimationIsPlaying(false);
    setAnimationCurrentTime(0);
    addToast({ message: '⏹️ Animation stopped', type: 'info', duration: 1500 });
  };

  const handleAnimationSeek = (time: number) => {
    setAnimationCurrentTime(time);
  };

  const handleAddAnimationTrack = (track: AnimationTrack) => {
    setAnimationTracks([...animationTracks, track]);
    addToast({ message: `➕ Added ${track.type} track`, type: 'success', duration: 2000 });
  };

  const handleDeleteAnimationTrack = (trackId: string) => {
    setAnimationTracks(animationTracks.filter((t) => t.id !== trackId));
    addToast({ message: '🗑️ Track deleted', type: 'info', duration: 1500 });
  };

  const handleUpdateKeyframe = (trackId: string, index: number, keyframe: any) => {
    setAnimationTracks(
      animationTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              keyframes: track.keyframes.map((kf, i) => (i === index ? keyframe : kf)),
            }
          : track
      )
    );
  };

  const handleAddKeyframe = (trackId: string, keyframe: any) => {
    setAnimationTracks(
      animationTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              keyframes: [...track.keyframes, keyframe].sort((a, b) => a.time - b.time),
            }
          : track
      )
    );
    addToast({ message: '💎 Keyframe added', type: 'success', duration: 1500 });
  };

  const handleDeleteKeyframes = (trackId: string, indices: number[]) => {
    setAnimationTracks(
      animationTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              keyframes: track.keyframes.filter((_, i) => !indices.includes(i)),
            }
          : track
      )
    );
    addToast({ message: `🗑️ Deleted ${indices.length} keyframe(s)`, type: 'info', duration: 1500 });
  };

  const handleApplyAnimationTemplate = (clips: AnimationClip[]) => {
    setAnimationClips([...animationClips, ...clips]);
    // Extract tracks from clips
    const newTracks = clips.flatMap((clip) => clip.tracks);
    setAnimationTracks([...animationTracks, ...newTracks]);
    addToast({
      message: `🎬 Applied ${clips.length} animation clip(s) with ${newTracks.length} tracks`,
      type: 'success',
      duration: 3000,
    });
  };

  const handleRecordingStop = (clip: AnimationClip) => {
    setAnimationClips([...animationClips, clip]);
    setAnimationTracks([...animationTracks, ...clip.tracks]);
    addToast({
      message: `🎬 Recording, saved: ${clip.name} (${clip.duration.toFixed(1)}s)`,
      type: 'success',
      duration: 3000,
    });
  };

  // Video export handlers
  const handleExportStart = () => {
    addToast({
      message: '🎬 Starting video export...',
      type: 'info',
      duration: 2000,
    });
  };

  const handleExportComplete = (result: ExportResult) => {
    if (result.success) {
      addToast({
        message: `✅ Video, exported: ${result.filename} (${videoExportService.formatFileSize(result.fileSize || 0)})`,
        type: 'success',
        duration: 5000,
      });
    } else {
      addToast({
        message: `❌ Export, failed: ${result.error}`,
        type: 'error',
        duration: 5000,
      });
    }
  };

  const handleFrameRender = (time: number, frameIndex: number) => {
    // Seek animation to the current frame time for rendering
    setAnimationCurrentTime(time);
    // Update the animation state manager to apply tracks
    animationStateManager.updateScene(time);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: !showOnboarding,
    callbacks: {
      onToggleGrid: () => {
        addToast({ message: 'Grid toggled', type: 'info', duration: 1500 });
      },
      onRotate: (degrees) => {
        addToast({ message: `Rotate ${degrees}°`, type: 'info', duration: 1500 });
      },
      onUndo: () => {
        const success = undoRedoService.undo();
        if (success) {
          addToast({ message: '↩️ Undo', type: 'info', duration: 1500 });
        }
      },
      onRedo: () => {
        const success = undoRedoService.redo();
        if (success) {
          addToast({ message: '↪️ Redo', type: 'info', duration: 1500 });
        }
      },
      onDelete: () => {
        addToast({ message: '🗑️ Delete selected', type: 'info', duration: 1500 });
      },
      onDuplicate: () => {
        addToast({ message: '📋 Duplicate', type: 'info', duration: 1500 });
      },
      onGroup: () => {
        addToast({ message: '📁 Group selected', type: 'info', duration: 1500 });
      },
      onUngroup: () => {
        addToast({ message: '📂 Ungroup', type: 'info', duration: 1500 });
      },
      onTogglePlay: () => {
        addToast({ message: isPlaying ? '⏸️ Pause' : '▶️ Play', type: 'info', duration: 1500 });
      },
      onDeselect: () => {
        addToast({ message: 'Deselected all', type: 'info', duration: 1500 });
      },
    },
  });

  // Show loading state while initializing
  if (!integration.isInitialized) {
    return (
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2}}
      >
        <CircularProgress size={60} />
        <Typography variant="h6">🚀 Initializing Virtual Studio...</Typography>
        <Typography variant="caption" color="text.secondary">
          Connecting to Master Integration, LUT Library, SVG Renderer, AI Vision, and Flask Backend
        </Typography>
      </Box>
    );
  }

  // Show success toast on initialization
  useEffect(() => {
    if (integration.isInitialized && !showOnboarding) {
      addToast({
        message: '✅ Virtual Studio initialized successfully',
        type: 'success',
        duration: 3000,
      });
    }
  }, [integration.isInitialized, showOnboarding, addToast]);

  return (
    <>
      {/* Onboarding Dialog */}
      <VirtualStudioOnboarding
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
        backendAPI={integration.backend as any}
      />
      
      {/* School Photography Setup Dialog */}
      <SchoolPhotographySetupDialog
        open={showSchoolPhotoSetup}
        onClose={() => setShowSchoolPhotoSetup(false)}
        onComplete={handleSchoolSetupComplete}
      />

      {/* Continue Session Dialog */}
      <ContinueSessionDialog
        open={showContinueDialog}
        session={previousSession}
        previousProjects={previousProjects}
        onContinue={handleContinueSession}
        onStartNew={handleStartNewProject}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
        onDuplicateProject={handleDuplicateProject}
        onToggleFavorite={handleToggleFavorite}
        onClose={handleCloseContinueDialog}
        isLoading={isLoadingSession}
        isLoadingProjects={isLoadingProjects}
      />

      <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
        {/* Services Status */}
        {integration.isInitialized && !showOnboarding && (
          <Alert severity="success" sx={{ m: 2 }} onClose={() => {}}>
            ✅ All systems ready: Master Integration Connected • LUT Library (
            {integration.status.lut?.library || 627} LUTs) • SVG Renderer (Resvg WASM) • AI Vision
            (ONNX) • Flask Backend ({integration.auth.isAuthenticated() ? 'Authenticated' : 'Ready'}
            )
          </Alert>
        )}

        {/* Top AppBar */}
        <AppBar position="static" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#1a1a1a', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
              sx={{ 
                mr: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                  transform: 'scale(1.1)'
                },
                '&:active': {
                  transform: 'scale(0.95)'
                }
              }}
            >
              <MenuIcon />
            </IconButton>

            <Videocam sx={{ mr: 1 }} />
            <Typography variant="h6" noWrap component="div" sx={{ mr: 3 }}>
              CreatorHub Virtual Studio
            </Typography>

            {/* Project Manager - Save/Load/Recent */}
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
              <ProjectManagerPanel
                onProjectLoad={handleProjectLoad}
                onProjectSave={handleProjectSave}
                currentProject={currentProject}
                googleDriveConnected={integration.googleDrive?.isAuthenticated || false}
                userId={user?.id}
              />
            </Box>

            {/* Import Button */}
            <Tooltip title="Import Scene/Assets">
              <IconButton
                color="inherit"
                onClick={() => setImportDialogOpen(true)}
                sx={{ 
                  mr: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    transform: 'scale(1.1)'
                  },
                  '&:active': {
                    transform: 'scale(0.95)'
                  }
                }}
              >
                <FileUpload />
              </IconButton>
            </Tooltip>

            {/* Push Notification Settings */}
            {isSupported && (
              <Tooltip title="Push-varsler innstillinger">
                <IconButton
                  color="inherit"
                  onClick={() => setPushSettingsOpen(true)}
                  sx={{ 
                    mr: 1, 
                    color: pushEnabled ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.1)',
                      transform: 'scale(1.1)',
                      color: 'rgba(255, 255, 255, 1)'
                    },
                    '&:active': {
                      transform: 'scale(0.95)'
                    }
                  }}
                >
                  {pushEnabled ? <NotificationsActive /> : <Notifications />}
                </IconButton>
              </Tooltip>
            )}

            <Box sx={{ flexGrow: 1 }} />

            {/* Status indicators */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {isRecording && (
                <Badge badgeContent="REC" color="error">
                  <Videocam />
                </Badge>
              )}
              {isPlaying && (
                <Badge badgeContent="▶" color="success">
                  <PlayArrow />
                </Badge>
              )}
              {tracks.length > 0 && (
                <Tooltip title={`${tracks.length} animation tracks`}>
                  <Badge badgeContent={tracks.length} color="primary">
                    <Animation />
                  </Badge>
                </Tooltip>
              )}
            </Box>

            {/* Input Mode Indicator (Tablet/iPad) */}
            {(isTablet || isIPad) && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  bgcolor: `${inputModeInfo.color}20`,
                  color: inputModeInfo.color,
                  fontSize: 12,
                  fontWeight: 50,
                  ml: 2}}
              >
                {inputModeInfo.icon}
                {inputModeInfo.label}
                {isPencilActive && (
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: '#4CAF50',
                      animation: 'pulse 1s infinite','@keyframes pulse': {
                        '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 },
                      }}}
                  />
                )}
              </Box>
            )}

            {/* Fullscreen Toggle */}
            <Tooltip title={isFullscreenMode ? 'Exit Fullscreen' : 'Fullscreen'}>
              <IconButton 
                color="inherit" 
                onClick={toggleFullscreen} 
                sx={{ 
                  ml: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    transform: 'scale(1.1)'
                  },
                  '&:active': {
                    transform: 'scale(0.95)'
                  }
                }}
              >
                {isFullscreenMode ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Toggle timeline">
              <IconButton
                color="inherit"
                onClick={() => {
                  if (isTablet || isMobile) {
                    setTabletPanelOpen(tabletPanelOpen === 'bottom' ? null : 'bottom');
                  } else {
                    setBottomDrawerOpen(!bottomDrawerOpen);
                  }
                }}
                sx={{ 
                  ml: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    transform: 'scale(1.1)'
                  },
                  '&:active': {
                    transform: 'scale(0.95)'
                  }
                }}
              >
                <TimelineIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Main content area */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Drawer - Controls */}
          {/* Desktop: Persistent Drawer */}
          {isDesktop && (
          <Drawer
            variant="persistent"
            anchor="left"
            open={leftDrawerOpen}
            sx={{
              width: DRAWER_WIDTH,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                marginTop: '64px', // AppBar height
                height: `calc(100vh - 64px - ${bottomDrawerOpen ? TIMELINE_HEIGHT : 0}px)`,
                backgroundColor: '#1a1a1a',
                color: '#fff',
                borderRight: '1px solid #2a2a2a',
                transition: 'width 225ms cubic-bezier(0.0, 0, 0.2, 1)'
              }}}
          >
            <Box sx={{ display: 'flex', height: '100%' }}>
              {/* Vertical Tabs */}
              <Tabs
                orientation="vertical"
                variant="scrollable"
                value={activeTab}
                onChange={handleTabChange}
                aria-label="Virtual Studio tabs"
                sx={{
                  borderRight: 1,
                  borderColor: '#2a2a2a',
                  minWidth: 80,
                  '& .MuiTab-root': {
                    color: '#888888',
                    transition: 'all 0.2s ease',
                    minHeight: 64,
                    '&.Mui-selected': {
                      color: '#2196f3',
                      bgcolor: 'rgba(33, 150, 243, 0.1)'
                    },
                    '&:hover': {
                      color: '#ffffff',
                      bgcolor: 'rgba(255,255,255,0.05)'
                    }
                  },
                  '& .MuiTabs-indicator': {
                    bgcolor: '#2196f3',
                    width: 3
                  }
                }}
              >
                <Tab icon={<Camera />} label="Camera" />
                <Tab icon={<ViewfinderIcon />} label="Viewfinder" />
                <Tab icon={<Lightbulb />} label="Lighting" />
                <Tab icon={<AutoAwesome />} label="Exposure" />
                <Tab icon={<CatalogIcon />} label="Catalog" />
                <Tab icon={<PresetsIcon />} label="Presets" />
                <Tab icon={<HistoryIcon />} label="History" />
                <Tab icon={<HierarchyIcon />} label="Hierarchy" />
                <Tab icon={<CompareIcon />} label="Compare" />
                <Tab icon={<AnimateIcon />} label="Animate" />
                <Tab icon={<Settings />} label="Rendering" />
                <Tab icon={<Animation />} label="Animation" />
                <Tab icon={<Inventory />} label="Equipment" />
                <Tab icon={<Landscape />} label="HDRI" />
                <Tab icon={<ColorLens />} label="Production" />
                <Tab icon={<Notifications />} label="Toasts" />
                <Tab icon={<Assignment />} label="Shot List" />
                <Tab icon={<PhotoLibrary />} label="Storyboard" />
                <Tab icon={<LibraryBooks />} label="Assets" />
                <Tab icon={<Person />} label="Characters" />
                <Tab icon={<Extension />} label="Modifiers" />
                <Tab icon={<Tune />} label="Color" />
                <Tab icon={<Straighten />} label="Measure" />
                <Tab icon={<Share />} label="Share" />
                <Tab icon={<Brush />} label="Brand Kit" />
                <Tab icon={<School />} label="Training" />
                <Tab icon={<GridOn />} label="Guides" />
                <Tab icon={<Layers />} label="Advanced" />
                <Tab icon={<RemoveRedEye />} label="Glasses" />
                <Tab icon={<Visibility />} label="Catchlight" />
                <Tab icon={<Accessibility />} label="Body" />
                <Tab icon={<School />} label="Class Photo" />
                <Tab icon={<Face />} label="Facial" />
                <Tab icon={<Monitor />} label="Monitor" />
              </Tabs>

              {/* Tab Panels */}
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <TabPanel value={activeTab} index={0}>
                  {/* Camera Tab */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <CameraPanel />
                    <Divider sx={{ borderColor: '#333' }} />
                    <CameraPathRecorder />
                    <Divider sx={{ borderColor: '#333' }} />
                    <CurveEditor />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={1}>
                  {/* Viewfinder Tab */}
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <ViewfinderView height="100%" showToolbar={true} />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={2}>
                  {/* Lighting Tab */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Wireless Flash Controller */}
                    <FlashControllerPanel />
                    
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    {/* Area Light Controls */}
                    <AreaLightPanel
                      lights={areaLights}
                      onAddLight={(light) => {
                        setAreaLights([...areaLights, light]);
                        addToast({
                          message: `Added ${light.config.type} light`,
                          type: 'success',
                          duration: 2000,
                        });
                      }}
                      onRemoveLight={(light) => {
                        setAreaLights(areaLights.filter((l) => l !== light));
                        addToast({
                          message: 'Light removed',
                          type: 'info',
                          duration: 2000,
                        });
                      }}
                      onUpdateLight={() => {
                        // Force re-render
                        setAreaLights([...areaLights]);
                      }}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={3}>
                  {/* Exposure/Integration Tab */}
                  <LightLensIntegrationPanel />
                </TabPanel>

                <TabPanel value={activeTab} index={4}>
                  {/* Equipment Catalog Tab */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <EquipmentCatalog onAddToScene={handleAddEquipmentFromCatalog} />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={5}>
                  {/* Scene Presets Tab */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <ScenePresets onLoadPreset={handleLoadPreset} />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={6}>
                  {/* History Tab */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <HistoryPanel />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={7}>
                  {/* Hierarchy Tab */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <EquipmentHierarchyPanel />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={8}>
                  {/* Scene Comparison Tab */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <SceneComparisonPanel
                      onCaptureSnapshot={() => {
                        // Would capture from 3D canvas
                        return null;
                      }}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={9}>
                  {/* Animation Studio Tab */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <AnimationStudioPanel
                      tracks={animationTracks}
                      clips={animationClips}
                      currentTime={animationCurrentTime}
                      isPlaying={animationIsPlaying}
                      selectedNodeId={selectedAnimationNodeId}
                      nodes={sceneNodes}
                      onPlay={handleAnimationPlay}
                      onPause={handleAnimationPause}
                      onStop={handleAnimationStop}
                      onSeek={handleAnimationSeek}
                      onAddTrack={handleAddAnimationTrack}
                      onDeleteTrack={handleDeleteAnimationTrack}
                      onUpdateKeyframe={handleUpdateKeyframe}
                      onAddKeyframe={handleAddKeyframe}
                      onDeleteKeyframes={handleDeleteKeyframes}
                      onApplyTemplate={handleApplyAnimationTemplate}
                      onRecordingStop={handleRecordingStop}
                      showMotionPaths={showMotionPaths}
                      onToggleMotionPaths={() => setShowMotionPaths(!showMotionPaths)}
                      onExportStart={handleExportStart}
                      onExportComplete={handleExportComplete}
                      onFrameRender={handleFrameRender}
                      userId={user?.id}
                      projectName="Virtual Studio Project"
                      onDriveUploadComplete={(result) => {
                        addToast({
                          message: `📁 Uploaded to Google Drive! View at ${result.webViewLink}`,
                          type: 'success',
                          duration: 8000,
                        });
                      }}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={10}>
                  {/* Rendering Tab */}
                  <RenderingSettingsPanel
                    pbrEnabled={pbrEnabled}
                    giEnabled={giEnabled}
                    volumetricsEnabled={volumetricsEnabled}
                    softShadowsEnabled={softShadowsEnabled}
                    giIntensity={giIntensity}
                    giBounces={giBounces}
                    volumetricQuality={volumetricQuality}
                    onTogglePBR={(enabled) => {
                      setPbrEnabled(enabled);
                      addToast({
                        message: `PBR ${enabled ? 'enabled' : 'disabled'}`,
                        type: 'info',
                        duration: 2000,
                      });
                    }}
                    onToggleGI={(enabled) => {
                      setGiEnabled(enabled);
                      addToast({
                        message: `Global Illumination ${enabled ? 'enabled' : 'disabled'}`,
                        type: 'info',
                        duration: 2000,
                      });
                    }}
                    onToggleVolumetrics={(enabled) => {
                      setVolumetricsEnabled(enabled);
                      addToast({
                        message: `Volumetric Lighting ${enabled ? 'enabled' : 'disabled'}`,
                        type: 'info',
                        duration: 2000,
                      });
                    }}
                    onToggleSoftShadows={(enabled) => {
                      setSoftShadowsEnabled(enabled);
                      addToast({
                        message: `Soft Shadows ${enabled ? 'enabled' : 'disabled'}`,
                        type: 'info',
                        duration: 2000,
                      });
                    }}
                    onUpdateGIIntensity={setGiIntensity}
                    onUpdateGIBounces={setGiBounces}
                    onUpdateVolumetricQuality={setVolumetricQuality}
                    vsmShadowsEnabled={vsmShadowsEnabled}
                    falseColorEnabled={falseColorEnabled}
                    falseColorOpacity={falseColorOpacity}
                    luminanceHeatmapEnabled={luminanceHeatmapEnabled}
                    luminanceHeatmapMin={luminanceHeatmapMin}
                    luminanceHeatmapMax={luminanceHeatmapMax}
                    luminanceHeatmapOpacity={luminanceHeatmapOpacity}
                    onToggleVSMShadows={(enabled) => {
                      setVsmShadowsEnabled(enabled);
                      if (enhancedRendererRef.current) {
                        enhancedRendererRef.current.toggleVSMShadows(enabled);
                      }
                      addToast({
                        message: `VSM Shadows ${enabled ? 'enabled' : 'disabled'}`,
                        type: 'info',
                        duration: 2000,
                      });
                    }}
                    onToggleFalseColor={(enabled) => {
                      setFalseColorEnabled(enabled);
                      if (enhancedRendererRef.current) {
                        enhancedRendererRef.current.toggleFalseColor(enabled);
                      }
                      addToast({
                        message: `False Color ${enabled ? 'enabled' : 'disabled'}`,
                        type: 'info',
                        duration: 2000,
                      });
                    }}
                    onFalseColorOpacityChange={(opacity) => {
                      setFalseColorOpacity(opacity);
                      if (enhancedRendererRef.current) {
                        enhancedRendererRef.current.setFalseColorOpacity(opacity);
                      }
                    }}
                    onToggleLuminanceHeatmap={(enabled) => {
                      setLuminanceHeatmapEnabled(enabled);
                      if (enhancedRendererRef.current) {
                        enhancedRendererRef.current.toggleLuminanceHeatmap(enabled);
                      }
                      addToast({
                        message: `Luminance Heatmap ${enabled ? 'enabled' : 'disabled'}`,
                        type: 'info',
                        duration: 2000,
                      });
                    }}
                    onLuminanceHeatmapRangeChange={(min, max) => {
                      setLuminanceHeatmapMin(min);
                      setLuminanceHeatmapMax(max);
                      if (enhancedRendererRef.current) {
                        enhancedRendererRef.current.setLuminanceHeatmapRange(min, max);
                      }
                    }}
                    onLuminanceHeatmapOpacityChange={(opacity) => {
                      setLuminanceHeatmapOpacity(opacity);
                      if (enhancedRendererRef.current) {
                        enhancedRendererRef.current.setLuminanceHeatmapOpacity(opacity);
                      }
                    }}
                  />
                </TabPanel>

                <TabPanel value={activeTab} index={11}>
                  {/* Animation Tab */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#222', color: '#fff' }}>
                      <Typography variant="h6" gutterBottom>
                        Animation Controls
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Use the timeline at the bottom to manage keyframes and playback.
                      </Typography>
                    </Paper>
                    <CurveEditor />
                    <CameraPathRecorder />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={12}>
                  {/* Equipment Tab (My Gear) */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <EquipmentBrowser />
                    <Divider sx={{ borderColor: '#333' }} />
                    <CostCalculator />
                    <Divider sx={{ borderColor: '#333' }} />
                    <ObjectExtractionPanel
                      open={false}
                      onClose={() => {}}
                      onObjectsExtracted={(objects) => {
                        console.log('✅ Objects extracted for 3D scene:', objects);
                        // Objects can be placed in the 3D scene
                      }}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={13}>
                  {/* HDRI Tab */}
                  <HDRIEnvironmentLoader />
                </TabPanel>

                <TabPanel value={activeTab} index={14}>
                  {/* Production Tab */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#222', color: '#fff' }}>
                      <Typography variant="h6" gutterBottom>
                        Production Tools
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Professional color grading, scene templates, and batch export.
                      </Typography>
                      <Divider sx={{ my: 2, borderColor: '#333' }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Coming Soon:{', '}
                      </Typography>
                      <ul style={{ paddingLeft: 20, margin: 0 }}>
                        <li>LUT Preview (10+ presets)</li>
                        <li>Color Grading Tools</li>
                        <li>Scene Templates (One-click setups)</li>
                        <li>Batch Export (Multiple scenes)</li>
                      </ul>
                    </Paper>

                    {/* AI Suggestions Settings */}
                    {user?.id && <AISuggestionsToggle userId={user.id} />}

                    <CostCalculator />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={15}>
                  {/* Toast Designer Tab */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#222', color: '#fff' }}>
                      <Typography variant="h6" gutterBottom>
                        Toast Notification Designer
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Design and preview toast notifications for Virtual Studio
                      </Typography>
                    </Paper>
                    <Box sx={{ overflow: 'auto', flex: 1 }}>
                      <ToastDesigner />
                    </Box>
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={16}>
                  {/* Shot List Integration Tab */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <ShotListIntegrationPanel
                      projectType={currentProject?.projectType || 'general'}
                      onShotSelect={(shot) => {
                        addToast({
                          message: `Selected, shot: ${shot.title}`,
                          type: 'info',
                          duration: 2000,
                        });
                      }}
                      onApplySetup={(setup) => {
                        addToast({
                          message: `Applied, setup: ${setup.name}`,
                          type: 'success',
                          duration: 3000,
                        });
                      }}
                      onShotTrained={(shot, setup) => {
                        addToast({
                          message: `Trained: ${shot.title} → ${setup.name}`,
                          type: 'success',
                          duration: 4000,
                        });
                      }}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={17}>
                  {/* Storyboard Tab - Native VS Feature */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <StoryboardPanel />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={18}>
                  {/* Assets Library */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <AssetLibraryPanel />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={19}>
                  {/* Character Models */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <CharacterModelLoader />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={20}>
                  {/* Light Modifiers */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <ModifierBrowser />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={21}>
                  {/* Color Grading */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <ColorGrading />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={22}>
                  {/* Measurements */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <MeasurementsPanel />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={23}>
                  {/* Client Sharing */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <ClientSharingPanel 
                      projectId={currentProject?.id || 'default'}
                      projectName={currentProject?.name || 'Untitled Project'}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={24}>
                  {/* Brand Kit */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <BrandKitShowcase />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={25}>
                  {/* Photography Training */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <PhotographyTrainingPanel />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={26}>
                  {/* Studio Guides */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <StudioGuidesPanel
                      settings={guideSettings}
                      onSettingsChange={(settings) => updateStudioGuideSettings(settings)}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={27}>
                  {/* Advanced Visual Guides */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <AdvancedGuidesPanel
                      settings={advancedGuideSettings}
                      onSettingsChange={updateAdvancedGuideSettings}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={28}>
                  {/* Glasses Reflection Guide */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2, p: 2 }}>
                    <GlassesReflectionPanel
                      enabled={advancedGuideSettings?.glassesReflection?.enabled ?? false}
                      onEnabledChange={(enabled) => updateAdvancedGuideSettings({
                        glassesReflection: { ...advancedGuideSettings.glassesReflection, enabled }
                      })}
                      headTiltAngle={advancedGuideSettings?.glassesReflection?.headTiltAngle ?? 0}
                      onHeadTiltChange={(headTiltAngle) => updateAdvancedGuideSettings({
                        glassesReflection: { ...advancedGuideSettings.glassesReflection, headTiltAngle }
                      })}
                      glassesAngle={advancedGuideSettings?.glassesReflection?.glassesAngle ?? 12}
                      onGlassesAngleChange={(glassesAngle) => updateAdvancedGuideSettings({
                        glassesReflection: { ...advancedGuideSettings.glassesReflection, glassesAngle }
                      })}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={29}>
                  {/* Catchlight Preview Panel */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2, p: 2 }}>
                    <CatchlightPanel
                      onSettingsChange={(settings) => {
                        // Catchlight settings can be used to update the scene
                        log.debug('Catchlight settings updated:', settings);
                      }}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={30}>
                  {/* Body Animation Panel */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2, p: 2 }}>
                    <BodyAnimationPanel
                      enabled={bodyAnimationEnabled}
                      onEnabledChange={setBodyAnimationEnabled}
                      headPreset={bodyHeadPreset}
                      onHeadPresetChange={(p) => setBodyHeadPreset(p as keyof typeof HEAD_PRESETS)}
                      handPreset={bodyHandPreset}
                      onHandPresetChange={(p) => setBodyHandPreset(p as keyof typeof HAND_PRESETS)}
                      gesture={bodyGesture}
                      onGestureChange={setBodyGesture}
                      fullBodyPose={bodyFullPose}
                      onFullBodyPoseChange={(p) => setBodyFullPose(p as keyof typeof FULL_BODY_POSES)}
                      animationPreset={bodyAnimPreset}
                      onAnimationPresetChange={(p) => setBodyAnimPreset(p as keyof typeof BODY_ANIMATION_PRESETS)}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={31}>
                  {/* Class Photo Panel */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2, display: 'flex', flexDirection: 'column' }}>
                    {/* Class Photo Controls */}
                    <Box sx={{ flex: showClassPhotoMode ? '0 0 40%' : '1', overflow: 'auto', p: 2 }}>
                      <ClassPhotoPanel
                        onSessionChange={(session) => {
                          setClassPhotoSession(session);
                          if (session) {
                            setShowClassPhotoMode(true);
                          }
                        }}
                        onStudentSelect={setSelectedClassPhotoStudent}
                        guideSettings={classPhotoGuideSettings}
                        onGuideSettingsChange={setClassPhotoGuideSettings}
                      />
                    </Box>
                    {/* Class Photo 3D View */}
                    {showClassPhotoMode && classPhotoSession && (
                      <Box sx={{ flex: '0 0 60%', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <ClassPhotoView
                          session={classPhotoSession}
                          selectedStudentId={selectedClassPhotoStudent}
                          onStudentClick={setSelectedClassPhotoStudent}
                          showVisibilityOverlay={true}
                          showHeightLabels={false}
                          showRowLabels={true}
                          guideSettings={classPhotoGuideSettings}
                        />
                      </Box>
                    )}
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={32}>
                  {/* Facial Features Panel */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2, p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Face Analysis Panel */}
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <FaceAnalysisPanel />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    {/* Scene Composition Analyzer */}
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <SceneCompositionAnalyzer
                        imageUrl={capturedImage}
                        onAnalysisComplete={(analysis) => {
                          console.log('✅ Composition analysis:', analysis);
                        }}
                      />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    {/* Multi-Subject Analyzer */}
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <MultiSubjectAnalyzer
                        imageUrl={capturedImage}
                        onAnalysisComplete={(analysis) => {
                          console.log('✅ Multi-subject analysis:', analysis);
                        }}
                      />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    {/* Pose Detection & Recommendations */}
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <PoseDetectionPanel
                        imageUrl={capturedImage}
                        onPoseDetected={(result) => {
                          console.log('✅ Pose detected:', result);
                        }}
                      />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <PoseRecommendationPanel
                        photographyType="portrait"
                        subjectCount={1}
                        onPoseSelect={(pose) => {
                          console.log('✅ Pose selected:', pose);
                        }}
                      />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    {/* Lighting & Exposure Analysis */}
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <LightingQualityAnalyzer
                        imageUrl={capturedImage}
                        onAnalysisComplete={(analysis) => {
                          console.log('✅ Lighting analysis:', analysis);
                        }}
                      />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <ShadowAnalysisPanel
                        imageUrl={capturedImage}
                        onAnalysisComplete={(analysis) => {
                          console.log('✅ Shadow analysis:', analysis);
                        }}
                      />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <ExposureColorAnalyzer
                        imageUrl={capturedImage}
                        onAnalysisComplete={(analysis) => {
                          console.log('✅ Exposure/color analysis:', analysis);
                        }}
                      />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    {/* Scene Optimization */}
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <AutoSceneOptimizer
                        imageUrl={capturedImage}
                        onOptimizationComplete={(optimization) => {
                          console.log('✅ Scene optimization:', optimization);
                        }}
                      />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <BackgroundAnalyzer
                        imageUrl={capturedImage}
                        onAnalysisComplete={(analysis) => {
                          console.log('✅ Background analysis:', analysis);
                        }}
                      />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <AIShotSuggestions
                        imageUrl={capturedImage}
                        onSuggestionSelect={(suggestion) => {
                          console.log('✅ Shot suggestion selected:', suggestion);
                        }}
                      />
                    </Paper>
                    <Divider sx={{ borderColor: '#333' }} />
                    {/* Facial Features Panel */}
                    <FacialFeaturesPanel
                      onExpressionChange={(expression, blendShapes) => {
                        log.debug('Expression changed:', expression, blendShapes);
                      }}
                      onFacialHairChange={(options) => {
                        log.debug('Facial hair changed:', options);
                      }}
                      onMakeupChange={(items) => {
                        log.debug('Makeup changed:', items);
                      }}
                      onSkinDetailsChange={(options) => {
                        log.debug('Skin details changed:', options);
                      }}
                    />
                  </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={33}>
                  {/* Director Monitor Panel */}
                  <Box sx={{ height: '100%', mx: -2, mt: -2 }}>
                    <MonitorFeedPanel />
                  </Box>
                </TabPanel>
              </Box>
            </Box>
          </Drawer>
          )}

          {/* Tablet/Mobile: Bottom Sheet for Left Panel */}
          {(isTablet || isMobile) && (
            <TabletBottomSheet
              isOpen={tabletPanelOpen === 'left'}
              onClose={() => setTabletPanelOpen(null)}
              title="Controls"
              height="75vh"
            >
              <Box sx={{ display: 'flex', height: '100%' }}>
                {/* Vertical Tabs - Simplified for tablet */}
                <Tabs
                  orientation="vertical"
                  variant="scrollable"
                  value={activeTab}
                  onChange={handleTabChange}
                  sx={{
                    borderRight: 1,
                    borderColor: '#2a2a2a',
                    minWidth: 60,
                    '& .MuiTab-root': { 
                      minWidth: 60, 
                      p: 1,
                      transition: 'all 0.2s ease',
                      color: '#888888',
                      '&.Mui-selected': {
                        color: '#2196f3',
                        bgcolor: 'rgba(33, 150, 243, 0.1)'
                      },
                      '&:hover': {
                        color: '#ffffff',
                        bgcolor: 'rgba(255,255,255,0.05)'
                      }
                    },
                    '& .MuiTabs-indicator': {
                      bgcolor: '#2196f3',
                      width: 3
                    }
                  }}
                >
                  <Tab icon={<Camera />} aria-label="Camera" />
                  <Tab icon={<ViewfinderIcon />} aria-label="Viewfinder" />
                  <Tab icon={<Lightbulb />} aria-label="Lighting" />
                  <Tab icon={<AutoAwesome />} aria-label="Exposure" />
                  <Tab icon={<CatalogIcon />} aria-label="Catalog" />
                  <Tab icon={<PresetsIcon />} aria-label="Presets" />
                  <Tab icon={<AnimateIcon />} aria-label="Animate" />
                  <Tab icon={<PhotoLibrary />} aria-label="Storyboard" />
                </Tabs>
                
                {/* Panel Content */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                  {activeTab === 0 && <CameraPanel />}
                  {activeTab === 1 && <ViewfinderView height="400px" showToolbar={true} />}
                  {activeTab === 2 && <FlashControllerPanel />}
                  {activeTab === 3 && <LightLensIntegrationPanel />}
                  {activeTab === 4 && <EquipmentCatalog onAddToScene={handleAddEquipmentFromCatalog} />}
                  {activeTab === 5 && <ScenePresets onLoadPreset={handleLoadPreset} />}
                  {activeTab === 6 && (
                    <AnimationStudioPanel
                      tracks={animationTracks}
                      clips={animationClips}
                      currentTime={animationCurrentTime}
                      isPlaying={animationIsPlaying}
                      selectedNodeId={selectedAnimationNodeId}
                      nodes={sceneNodes}
                      onPlay={handleAnimationPlay}
                      onPause={handleAnimationPause}
                      onStop={handleAnimationStop}
                      onSeek={handleAnimationSeek}
                      onAddTrack={handleAddAnimationTrack}
                      onDeleteTrack={handleDeleteAnimationTrack}
                      onUpdateKeyframe={handleUpdateKeyframe}
                      onAddKeyframe={handleAddKeyframe}
                      onDeleteKeyframes={handleDeleteKeyframes}
                      onApplyTemplate={handleApplyAnimationTemplate}
                      onRecordingStop={handleRecordingStop}
                      showMotionPaths={showMotionPaths}
                      onToggleMotionPaths={() => setShowMotionPaths(!showMotionPaths)}
                      onExportStart={handleExportStart}
                      onExportComplete={handleExportComplete}
                      onFrameRender={handleFrameRender}
                      userId={user?.id}
                      projectName="Virtual Studio Project"
                    />
                  )}
                  {activeTab === 7 && <StoryboardPanel />}
                </Box>
              </Box>
            </TabletBottomSheet>
          )}

          {/* Tablet/Mobile: Bottom Sheet for Timeline */}
          {(isTablet || isMobile) && (
            <TabletBottomSheet
              isOpen={tabletPanelOpen === 'bottom'}
              onClose={() => setTabletPanelOpen(null)}
              title="Timeline"
              height="50vh"
            >
              <TimelinePanel />
            </TabletBottomSheet>
          )}

          {/* Center - 3D Viewport */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              position: 'relative',
              backgroundColor: '#000',
              // Only apply margin on desktop
              marginLeft: isDesktop ? (leftDrawerOpen ? 0 : `-${DRAWER_WIDTH}px`) : 0,
              transition: 'margin 225ms cubic-bezier(0.0, 0, 0.2, 1)'}}
          >
            {/* 3D Scene with Gesture Support */}
            <GestureView
              style={{ width: '100%', height: '100%' }}
              onPinchZoom={(scale) => {
                // Dispatch zoom event to 3D canvas
                window.dispatchEvent(new CustomEvent('ch-camera-zoom', { detail: { scale } }));
              }}
              onDoubleTap={() => {
                // Reset camera view on double-tap
                window.dispatchEvent(new CustomEvent('ch-camera-reset'));
              }}
            >
            {useEnhancedRenderer ? (
              <Box sx={{ height: '100vh', width: '100%' }}>
                <EnhancedStage3D
                  pbrEnabled={pbrEnabled}
                  giEnabled={giEnabled}
                  volumetricsEnabled={volumetricsEnabled}
                  softShadowsEnabled={softShadowsEnabled}
                  giIntensity={giIntensity}
                  giBounces={giBounces}
                  volumetricQuality={volumetricQuality}
                  areaLights={areaLights}
                  onRendererReady={(renderer) => {
                    enhancedRendererRef.current = renderer;
                    log.info('EnhancedRenderer ready:', renderer.getRenderingStats());
                  }}
                  onSceneReady={(scene) => {
                    log.debug('Scene ready');
                  }}
                />
              </Box>
            ) : (
              <Stage3D />
            )}
            </GestureView>
            
            {/* Director Mode Overlay - shown when zoomed into monitor */}
            <DirectorModeOverlay
              isActive={directorModeState.isActive}
              monitorId={directorModeState.monitorId || ', '}
              monitorName={directorModeState.monitorName}
              onExit={handleExitDirectorMode}
              cameraCount={nodes.filter(n => n.type === 'camera' || n.camera).length || 1}
              cameras={nodes
                .filter(n => n.type === 'camera' || n.camera)
                .map(n => ({ id: n.id, name: n.name || `Camera ${n.id.substring(0, 8)}` }))}
            />

            {/* 2D Composition & Video Production Overlays */}
            {advancedGuideSettings.composition.enabled && (
              <CompositionOverlays
                activeGuides={advancedGuideSettings.composition.guides}
                color={advancedGuideSettings.composition.color}
                opacity={advancedGuideSettings.composition.opacity}
              />
            )}

            {advancedGuideSettings.videoProduction.enabled && (
              <VideoProductionGuides
                showTitleSafe={advancedGuideSettings.videoProduction.showTitleSafe}
                showActionSafe={advancedGuideSettings.videoProduction.showActionSafe}
                showAspectRatioMask={advancedGuideSettings.videoProduction.showAspectRatioMask}
                showCenterMarkers={advancedGuideSettings.videoProduction.showCenterMarkers}
                aspectRatio={advancedGuideSettings.videoProduction.aspectRatio}
              />
            )}

            {advancedGuideSettings.colorExposure.enabled && (
              <ColorExposureOverlay
                showColorTemperatureScale={advancedGuideSettings.colorExposure.showColorTemperatureScale}
                showExposureZones={advancedGuideSettings.colorExposure.showExposureZones}
                lightColorTemperature={5500}
              />
            )}

            {/* Accessible 3D Controls - WCAG 2.5.7 keyboard alternatives */}
            <Accessible3DControls
              cameraState={a11yCameraState}
              onCameraChange={handleA11yCameraChange}
              onCameraReset={() => {
                setA11yCameraState({
                  position: [0, 1.5, 5],
                  target: [0, 1, 0],
                  zoom: 1,
                  fov: 50,
                });
                window.dispatchEvent(new CustomEvent('ch-camera-reset'));
                announce('Camera reset to default position');
              }}
              selectedObject={
                selectionService.getState().selectedIds[0]
                  ? a11ySceneObjects.find(o => o.id === selectionService.getState().selectedIds[0]) || null
                  : null
              }
              objects={a11ySceneObjects}
              onObjectSelect={(id) => {
                if (id) {
                  selectionService.select(id);
                  const obj = a11ySceneObjects.find(o => o.id === id);
                  if (obj) {
                    announce(`Selected: ${obj.name}`);
                  }
                } else {
                  selectionService.clear();
                  announce('Selection cleared');
                }
              }}
              onObjectTransform={handleA11yObjectTransform}
              showPanel={prefersKeyboard || a11ySettings.showKeyboardHints}
              position="right"
              enableKeyboardControls={a11ySettings.enableKeyboardShortcuts}
            />

            {/* Light Meter Overlay */}
            {/* <LightMeterOverlay mode="none" onModeChange={() => {} canvas={null} /> */}

            {/* Floating Action Buttons */}
            <Box
              sx={{
                position: 'absolute',
                bottom: (isDesktop && bottomDrawerOpen) ? TIMELINE_HEIGHT + 16 : 16,
                right: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 1}}
            >
              {/* Tablet: Panel Toggle Buttons */}
              {(isTablet || isMobile) && (
                <>
                  <Tooltip title="Open Controls" placement="left">
                    <Fab
                      color="primary"
                      size={isTablet ? 'medium' : 'small'}
                      onClick={() => setTabletPanelOpen('left')}
                      sx={{ 
                        backgroundColor: '#1a1a2e',
                        width: isTablet ? 56 : 40,
                        height: isTablet ? 56 : 40,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: '#2a2a3e',
                          transform: 'scale(1.1)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                        },
                        '&:active': {
                          transform: 'scale(0.95)'
                        }
                      }}
                    >
                      <ViewSidebar />
                    </Fab>
                  </Tooltip>
                  <Tooltip title="Open Timeline" placement="left">
                    <Fab
                      color="default"
                      size={isTablet ? 'medium' : 'small'}
                      onClick={() => setTabletPanelOpen('bottom')}
                      sx={{ 
                        backgroundColor: '#252530',
                        width: isTablet ? 56 : 40,
                        height: isTablet ? 56 : 40,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: '#353540',
                          transform: 'scale(1.1)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                        },
                        '&:active': {
                          transform: 'scale(0.95)'
                        }
                      }}
                    >
                      <TimelineIcon />
                    </Fab>
                  </Tooltip>
                </>
              )}
              
              <Tooltip title="Undo (Ctrl+Z)" placement="left">
                <Fab 
                  color="default" 
                  size={isTablet ? 'medium' : 'small'}
                  onClick={() => undoRedoService.undo()}
                  sx={{ 
                    backgroundColor: '#252530',
                    width: isTablet ? 56 : 40,
                    height: isTablet ? 56 : 40,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: '#353540',
                      transform: 'scale(1.1)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                    },
                    '&:active': {
                      transform: 'scale(0.95)'
                    }
                  }}
                >
                  <Undo />
                </Fab>
              </Tooltip>
              <Tooltip title="Redo (Ctrl+Shift+Z)" placement="left">
                <Fab 
                  color="default" 
                  size={isTablet ? 'medium' : 'small'}
                  onClick={() => undoRedoService.redo()}
                  sx={{ 
                    backgroundColor: '#252530',
                    width: isTablet ? 56 : 40,
                    height: isTablet ? 56 : 40,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: '#353540',
                      transform: 'scale(1.1)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                    },
                    '&:active': {
                      transform: 'scale(0.95)'
                    }
                  }}
                >
                  <Redo />
                </Fab>
              </Tooltip>
              <Tooltip title="Export Video" placement="left">
                <Fab 
                  color="primary" 
                  size={isTablet ? 'medium' : 'small'}
                  sx={{
                    width: isTablet ? 56 : 40,
                    height: isTablet ? 56 : 40,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)'
                    },
                    '&:active': {
                      transform: 'scale(0.95)'
                    }
                  }}
                >
                  <GetApp />
                </Fab>
              </Tooltip>
            </Box>
            
            {/* Keyboard Shortcuts Button */}
            <KeyboardShortcutsFloatingButton position="bottom-left" />
            
            {/* Prototype Feedback Tool - Only shows for prototype testers */}
            <PrototypeFeedbackTool 
              profession={userEnvironment?.profession || 'photographer'}
              component="Virtual Studio"
            />
            
            {/* Quick Access Toolbar */}
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10}}
            >
              <QuickAccessToolbar
                transformMode={transformMode}
                onTransformModeChange={setTransformMode}
                showGrid={showGrid}
                onToggleGrid={() => setShowGrid(!showGrid)}
                onDelete={() => {
                  selectionService.getSelectedIds().forEach((id) => {
                    window.dispatchEvent(new CustomEvent('ch-delete-node', { detail: { id } }));
                  });
                  selectionService.clear();
                }}
                onDuplicate={() => {
                  const ids = selectionService.getSelectedIds();
                  if (ids.length > 0) {
                    const newIds = equipmentGroupingService.duplicateNodes(ids);
                    selectionService.select(newIds);
                    addToast({ message: `📋 Duplicated ${ids.length} item(s)`, type: 'success', duration: 2000 });
                  }
                }}
                onGroup={() => {
                  const ids = selectionService.getSelectedIds();
                  if (ids.length > 1) {
                    equipmentGroupingService.createGroup('New Group', ids);
                    addToast({ message: `📁 Grouped ${ids.length} items`, type: 'success', duration: 2000 });
                  }
                }}
                onFocus={() => {
                  addToast({ message: '🎯 Focus selection', type: 'info', duration: 1500 });
                }}
                onTogglePlay={() => {
                  if (animationIsPlaying) {
                    handleAnimationPause();
                  } else {
                    handleAnimationPlay();
                  }
                }}
                isPlaying={animationIsPlaying}
              />
            </Box>

            {/* Toggle drawer button (when closed) */}
            {!leftDrawerOpen && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 16,
                  left: 16}}
              >
                <Fab 
                  color="primary" 
                  size="small" 
                  onClick={() => setLeftDrawerOpen(true)}
                  sx={{
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)'
                    },
                    '&:active': {
                      transform: 'scale(0.95)'
                    }
                  }}
                >
                  <ChevronRight />
                </Fab>
              </Box>
            )}
          </Box>
        </Box>

        {/* Bottom Drawer - Timeline (Desktop only) */}
        {isDesktop && (
          <Drawer
            variant="persistent"
            anchor="bottom"
            open={bottomDrawerOpen}
            sx={{
              '& .MuiDrawer-paper': {
                height: TIMELINE_HEIGHT,
                boxSizing: 'border-box',
                backgroundColor: '#0a0a0a',
                borderTop: '1px solid #2a2a2a',
                transition: 'height 225ms cubic-bezier(0.0, 0, 0.2, 1)'
              }}}
          >
            <TimelinePanel />
          </Drawer>
        )}

        {/* Import Dialog */}
        <ImportDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          onImport={(data) => {
            addToast({
              message: `Imported ${data.type === 'scene' ? 'scene': data.type === 'nodes' ? `${data.nodes?.length} nodes` : 'asset'}`,
              type:'success',
              duration: 3000,
            });
          }}
        />

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
      </Box>
    </>
  );
};

// Wrap with providers (VirtualStudio + TabletSupport)
export const VirtualStudio: React.FC = () => {
  return (
    <AccessibilityProvider>
      <TabletSupportProvider>
        <VirtualStudioProvider>
          <FaceAnalysisProvider>
            <VirtualStudioInner />
          </FaceAnalysisProvider>
        </VirtualStudioProvider>
      </TabletSupportProvider>
    </AccessibilityProvider>
  );
};

export default VirtualStudio;
