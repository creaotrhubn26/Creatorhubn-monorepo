/**
 * CreatorHub Virtual Studio - Main Export File
 * 
 * Re-exports all key components, hooks, and services.
 */

// =============================================================================
// CORE SERVICES
// =============================================================================

export { exposureCalculator } from './core/services/exposureCalculatorService';
export type {
  LightSource,
  CameraSettings,
  ExposureRecommendation,
  SceneExposureAnalysis,
  LightAtDistance,
} from './core/services/exposureCalculatorService';
export { MODIFIER_LIGHT_LOSS, FLASH_SYNC_SPEEDS, MOUNT_COMPATIBILITY } from './core/services/exposureCalculatorService';

// =============================================================================
// LENS EFFECTS
// =============================================================================

export { 
  lensEffects,
  LensEffectsPass,
  lensSpecToEffects,
  VignettingShader,
  DistortionShader,
  ChromaticAberrationShader,
  drawVignetteOverlay,
} from './core/rendering/LensEffectsRenderer';
export type { LensEffectsParams } from './core/rendering/LensEffectsRenderer';

// =============================================================================
// DATA/SPECIFICATIONS
// =============================================================================

export { 
  findLensSpec, 
  findLensSpecByBrand, 
  getDefaultLensSpec,
  getFocalLengthFromLensSpec,
  getMaxApertureFromLensSpec,
  lensSpecToCameraData,
} from './core/data/LensSpecifications';
export type { LensSpec } from './core/data/LensSpecifications';

export { 
  findLightSpec, 
  findLightSpecByBrand, 
  getDefaultLightSpec,
} from './core/data/LightSpecifications';
export type { StudioLight, LightType } from './core/data/LightSpecifications';

// Pattern Integration
export { patternExposureIntegration } from './core/services/patternExposureIntegration';
export type {
  PatternLightRequirement,
  EquipmentMatch,
  PatternExposureAnalysis,
} from './core/services/patternExposureIntegration';

// =============================================================================
// HOOKS
// =============================================================================

export { useLightLensIntegration } from './hooks/useLightLensIntegration';
export type { 
  LightInfo, 
  CameraInfo, 
  IntegrationWarnings,
  SceneAnalysis,
} from './hooks/useLightLensIntegration';

// =============================================================================
// UI COMPONENTS
// =============================================================================

// Panels
export { LightLensIntegrationPanel, CompactExposureWidget } from './ui/panels/LightLensIntegrationPanel';
export { RecommendedSettingsPanel, InverseSquareLawCalculator } from './ui/panels/RecommendedSettingsPanel';
export { PatternExposurePanel } from './ui/panels/PatternExposurePanel';
export { MasterIntegrationPanel } from './ui/panels/MasterIntegrationPanel';

// Master Integration
export { masterLightingIntegration } from './core/services/masterLightingIntegration';
export type {
  HDRIExposureData,
  TemplateExposureData,
  GearPresetState,
  LUTRecommendation,
  MultiCameraExposure,
  HistogramFeedback,
  CommunityShareData,
  VirtualActorMetering,
  TimelineExposureKeyframe,
} from './core/services/masterLightingIntegration';

// Master Integration Hook
export { useMasterLightingIntegration } from './hooks/useMasterLightingIntegration';

// Components
export { LensAttachmentManager, QuickLensSwapButton } from './ui/components/LensAttachmentManager';
export { LensEffectsPreview } from './ui/components/LensEffectsPreview';

// Viewfinder
export { default as ViewfinderView, ViewfinderPanel, ViewfinderViewInner } from './ui/features/ViewfinderView';

// Flash Controller
export { default as FlashControllerPanel, FlashControllerWidget } from './ui/panels/FlashControllerPanel';
export { useFlashController } from './hooks/useFlashController';
export type { FlashControllerState, ConnectedLight, UseFlashControllerReturn } from './hooks/useFlashController';
export {
  ALL_FLASH_CONTROLLERS,
  PROFOTO_CONTROLLERS,
  GODOX_CONTROLLERS,
  POCKETWIZARD_CONTROLLERS,
  ELINCHROM_CONTROLLERS,
  BRONCOLOR_CONTROLLERS,
  findFlashController,
  findControllersByBrand,
  findControllersForLight,
  getControllerById,
  getControllerThumbnail,
  CONTROLLER_THUMBNAILS,
  powerToStops,
  stopsToPower,
  formatPowerFraction,
  formatPowerStops,
  createDefaultGroups,
  // Recommendation system
  getControllerRecommendations,
  getBestControllerForLights,
  getRecommendationMessage,
  BRAND_CONTROLLER_MAP,
} from './core/data/FlashControllerData';
export type { LightInScene, ControllerRecommendation } from './core/data/FlashControllerData';

// Flash Controller 3D Models
export {
  FlashControllerModelGenerator,
  flashControllerModelGenerator,
  createFlashControllerModel,
  createSpeedliteModel,
  createCameraBodyModel,
  createLensModel,
} from './core/models/FlashControllerModels';
export type {
  ControllerStyle,
  CameraStyle,
  FlashStyle,
  LensStyle,
  ControllerModelOptions,
  SpeedliteModelOptions,
  CameraModelOptions,
  LensModelOptions,
} from './core/models/FlashControllerModels';

// Studio Support 3D Models
export {
  StudioSupportModelGenerator,
  studioSupportModelGenerator,
  createCStandModel,
  createLightStandModel,
  createBoomArmModel,
  createSandbagModel,
  createAppleBoxModel,
  createSuperClampModel,
  createBackdropStandModel,
  createReflectorWithHolderModel,
  createTripodModel,
  createGoboHeadModel,
} from './core/models/StudioSupportModels';
export type {
  CStandOptions,
  LightStandOptions,
  BoomArmOptions,
  BackdropStandOptions,
  TripodOptions,
  AppleBoxOptions,
  SandbagOptions,
  ClampOptions,
  ReflectorHolderOptions,
} from './core/models/StudioSupportModels';

// Studio Backdrop & Surface Models
export {
  StudioBackdropModelGenerator,
  studioBackdropModelGenerator,
  createSeamlessBackdropModel,
  createCycloramaModel,
  createVFlatModel,
  createProductTableModel,
  createLightGridModel,
  createScrimFlagModel,
  createDiffusionFrameModel,
  createTexturedBackdropModel,
} from './core/models/StudioBackdropModels';
export type {
  BackdropMaterial,
  BackdropColor,
  BackdropTexture,
  SeamlessBackdropOptions,
  CycloramaOptions,
  VFlatOptions,
  ProductTableOptions,
  LightGridOptions,
  ScrimFlagOptions,
  DiffusionFrameOptions,
} from './core/models/StudioBackdropModels';
export type {
  FlashController,
  FlashGroup,
  FlashControllerBrand,
  ControllerMount,
  CommunicationProtocol,
} from './core/data/FlashControllerData';
export { 
  FrameGuidesOverlay,
  CameraInfoHUD,
  HistogramOverlay,
  ExposureWarning,
  FocusIndicator,
  LetterboxOverlay,
  RecordingIndicator,
  ViewfinderToggleButtons,
  AspectRatioSelector,
} from './ui/components/ViewfinderOverlays';
export { useViewfinder, ViewfinderProvider, useViewfinderContext } from './hooks/useViewfinder';
export { 
  ViewfinderRenderer,
  DEFAULT_VIEWFINDER_SETTINGS,
  calculateEV,
  calculateExposureInfo,
  calculateDOF,
  formatCameraInfo,
  generateFrameGuides,
  generateHistogramFromImageData,
  calculateLetterbox,
  getAspectRatioDimensions,
  ZEBRA_SHADER,
  FOCUS_PEAKING_SHADER,
  LENS_EFFECTS_SHADER,
} from './core/rendering/ViewfinderRenderer';
export type {
  ViewfinderSettings,
  CameraState,
  ExposureInfo,
  FocusInfo,
  CameraInfoDisplay,
  HistogramData,
  FrameGuide,
} from './core/rendering/ViewfinderRenderer';

// =============================================================================
// STUDIO LIGHT 3D MODELS (Monolights, LEDs, Fresnel, Ring, Tube, COB, Practicals)
// =============================================================================

export {
  StudioLightModelGenerator,
  studioLightModelGenerator,
  createMonolightModel,
  createLEDPanelModel,
  createFresnelModel,
  createRingLightModel,
  createTubeLightModel,
  createCOBLightModel,
  createPracticalLightModel,
} from './core/models/StudioLightModels';
export type {
  MonolightOptions,
  LEDPanelOptions,
  FresnelOptions,
  RingLightOptions,
  TubeLightOptions,
  COBLightOptions,
  PracticalLightOptions,
} from './core/models/StudioLightModels';

// =============================================================================
// LIGHT MODIFIER 3D MODELS (Softboxes, Octaboxes, Beauty Dishes, Umbrellas, etc.)
// =============================================================================

export {
  LightModifierModelGenerator,
  lightModifierModelGenerator,
  createSoftboxModel,
  createOctaboxModel,
  createBeautyDishModel,
  createUmbrellaModel,
  createSnootModel,
  createBarnDoorsModel,
  createGelFrameModel,
  createGoboModel,
} from './core/models/LightModifierModels';
export type {
  SoftboxOptions,
  OctaboxOptions,
  BeautyDishOptions,
  UmbrellaOptions,
  SnootOptions,
  BarnDoorOptions,
  GelFrameOptions,
  GoboOptions,
} from './core/models/LightModifierModels';

// =============================================================================
// CAMERA MOTION 3D MODELS (Sliders, Dollies, Jibs, Gimbals, Cages, Follow Focus)
// =============================================================================

export {
  CameraMotionModelGenerator,
  cameraMotionModelGenerator,
  createSliderModel,
  createDollyModel,
  createJibModel,
  createGimbalModel,
  createCameraCageModel,
  createFollowFocusModel,
  createMatteBoxModel,
  createCameraRailsModel,
} from './core/models/CameraMotionModels';
export type {
  SliderOptions,
  DollyOptions,
  JibOptions,
  GimbalOptions,
  CameraCageOptions,
  FollowFocusOptions,
  MatteBoxOptions,
  CameraRailOptions,
} from './core/models/CameraMotionModels';

// =============================================================================
// AUDIO EQUIPMENT 3D MODELS (Boom Poles, Mics, Recorders, Headphones, etc.)
// =============================================================================

export {
  AudioEquipmentModelGenerator,
  audioEquipmentModelGenerator,
  createBoomPoleModel,
  createMicStandModel,
  createShotgunMicModel,
  createLavalierModel,
  createAudioRecorderModel,
  createHeadphonesModel,
  createPopFilterModel,
  createShockMountModel,
} from './core/models/AudioEquipmentModels';
export type {
  BoomPoleOptions,
  MicStandOptions,
  ShotgunMicOptions,
  LavalierOptions,
  AudioRecorderOptions,
  HeadphonesOptions,
  PopFilterOptions,
  ShockMountOptions,
} from './core/models/AudioEquipmentModels';

// =============================================================================
// SET FURNITURE 3D MODELS (Stools, Chairs, Makeup Stations, Racks, Plants, etc.)
// =============================================================================

export {
  SetFurnitureModelGenerator,
  setFurnitureModelGenerator,
  createPosingStoolModel,
  createDirectorChairModel,
  createMakeupStationModel,
  createWardrobeRackModel,
  createPlantModel,
  createCouchModel,
  createDeskModel,
} from './core/models/SetFurnitureModels';
export type {
  PosingStoolOptions,
  DirectorChairOptions,
  MakeupStationOptions,
  WardrobeRackOptions,
  PlantOptions,
  CouchOptions,
  DeskOptions,
} from './core/models/SetFurnitureModels';

// =============================================================================
// VIDEO PRODUCTION 3D MODELS (Teleprompters, Monitors, Clapperboards, Carts)
// =============================================================================

export {
  VideoProductionModelGenerator,
  videoProductionModelGenerator,
  createTeleprompterModel,
  createMonitorModel,
  createClapperboardModel,
  createCartModel,
  createPowerDistroModel,
  createCableRampModel,
} from './core/models/VideoProductionModels';
export type {
  TeleprompterOptions,
  MonitorOptions,
  ClapperboardOptions,
  CartOptions,
  PowerDistroOptions,
  CableRampOptions,
} from './core/models/VideoProductionModels';

// =============================================================================
// SPECIAL EFFECTS 3D MODELS (Haze Machines, Fans, Rain Rigs, Mirror Boards)
// =============================================================================

export {
  SpecialEffectsModelGenerator,
  specialEffectsModelGenerator,
  createHazeMachineModel,
  createFanModel,
  createRainRigModel,
  createMirrorBoardModel,
} from './core/models/SpecialEffectsModels';
export type {
  HazeMachineOptions,
  FanOptions,
  RainRigOptions,
  MirrorBoardOptions,
} from './core/models/SpecialEffectsModels';

// =============================================================================
// GRIP HARDWARE 3D MODELS (Clamps, Speed Rail, Grip Heads, Menace Arms, etc.)
// =============================================================================

export {
  GripHardwareModelGenerator,
  gripHardwareModelGenerator,
  createMaferClampModel,
  createCardelliniClampModel,
  createSpeedRailModel,
  createGripHeadModel,
  createMenaceArmModel,
  createWallSpreaderModel,
  createSpigotAdapterModel,
} from './core/models/GripHardwareModels';
export type {
  MaferClampOptions,
  CardelliniClampOptions,
  SpeedRailOptions,
  GripHeadOptions,
  MenaceArmOptions,
  WallSpreaderOptions,
  SpigotAdapterOptions,
} from './core/models/GripHardwareModels';

// =============================================================================
// EQUIPMENT CATALOG & BROWSER
// =============================================================================

export {
  EquipmentCatalog,
  EQUIPMENT_CATALOG,
  CATEGORY_INFO as EQUIPMENT_CATEGORY_INFO,
} from './ui/panels/EquipmentCatalog';
export type {
  EquipmentCategory,
  EquipmentItem,
} from './ui/panels/EquipmentCatalog';

// =============================================================================
// SCENE PRESETS
// =============================================================================

export {
  ScenePresets,
  SCENE_PRESETS,
} from './ui/panels/ScenePresets';
export type {
  ScenePreset,
  SceneEquipmentItem,
} from './ui/panels/ScenePresets';

// =============================================================================
// EQUIPMENT INTEGRATION SERVICE
// =============================================================================

export {
  equipmentIntegrationService,
  MODEL_FUNCTION_REGISTRY,
  EQUIPMENT_TYPE_MAP,
} from './core/services/equipmentIntegrationService';
export type {
  SceneNode as EquipmentSceneNode,
  EquipmentTypeInfo,
  ModelFunction,
} from './core/services/equipmentIntegrationService';

// =============================================================================
// DRAG & DROP
// =============================================================================

export {
  useCanvasDragDrop,
  createDropIndicatorMaterial,
  createDropIndicatorGeometry,
} from './hooks/useCanvasDragDrop';
export type {
  DropPosition,
  DragDropState,
  UseCanvasDragDropOptions,
  UseCanvasDragDropReturn,
} from './hooks/useCanvasDragDrop';

export {
  DropIndicator,
  DragOverlay,
} from './ui/components/DropIndicator';

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================

export {
  useKeyboardShortcuts,
  SHORTCUT_REFERENCE,
} from './hooks/useKeyboardShortcuts';
export type {
  TransformMode,
  KeyboardShortcutCallbacks,
  UseKeyboardShortcutsOptions,
  UseKeyboardShortcutsReturn,
} from './hooks/useKeyboardShortcuts';

export {
  KeyboardShortcutsPanel,
  KeyboardShortcutsDialog,
  KeyboardShortcutsFloatingButton,
  QuickShortcutHint,
} from './ui/components/KeyboardShortcutsPanel';

// =============================================================================
// EQUIPMENT GROUPING
// =============================================================================

export {
  equipmentGroupingService,
} from './core/services/equipmentGroupingService';
export type {
  EquipmentNode,
  EquipmentGroup,
  LinkSuggestion,
} from './core/services/equipmentGroupingService';

// =============================================================================
// UNDO/REDO
// =============================================================================

export {
  undoRedoService,
} from './core/services/undoRedoService';
export type {
  ActionType,
  Action,
  UndoRedoState,
  UndoRedoCallbacks,
} from './core/services/undoRedoService';

// =============================================================================
// UI PANELS (History & Hierarchy)
// =============================================================================

export {
  HistoryPanel,
} from './ui/panels/HistoryPanel';

export {
  EquipmentHierarchyPanel,
} from './ui/panels/EquipmentHierarchyPanel';

// =============================================================================
// SELECTION SERVICE
// =============================================================================

export {
  selectionService,
  useSelection,
} from './core/services/selectionService';
export type {
  SelectionState,
  SelectionEvent,
  SelectionListener,
} from './core/services/selectionService';

// =============================================================================
// SCENE COMPARISON
// =============================================================================

export {
  SceneComparisonPanel,
  snapshotManager,
} from './ui/components/SceneComparison';
export type { SceneSnapshot as ComparisonSceneSnapshot } from './ui/components/SceneComparison';

// =============================================================================
// KEYBOARD SHORTCUTS REFERENCE
// =============================================================================

export {
  ShortcutsReferenceCard,
  KeyboardShortcutsExportDialog,
} from './ui/components/KeyboardShortcutsReference';

// =============================================================================
// SCENE ANIMATION
// =============================================================================

export {
  sceneAnimationService,
  ANIMATION_PRESETS,
  EASING_FUNCTIONS,
} from './core/services/sceneAnimationService';
export type {
  EasingType,
  Keyframe,
  AnimationTrackConfig,
  AnimationClipConfig,
  AnimationState,
  AnimatedObject,
} from './core/services/sceneAnimationService';

export { useSceneAnimation } from './hooks/useSceneAnimation';
export type { UseSceneAnimationReturn } from './hooks/useSceneAnimation';

export { SceneAnimationPanel } from './ui/panels/SceneAnimationPanel';
export { KeyframeTimeline } from './ui/panels/KeyframeTimeline';

// =============================================================================
// SCENE GRAPH ANIMATION ENGINE (PROFESSIONAL PIPELINE)
// =============================================================================

export {
  sceneGraphAnimationEngine,
  SceneGraphAnimationEngine,
  EASING_FUNCTIONS as PROFESSIONAL_EASING_FUNCTIONS,
} from './core/animation/SceneGraphAnimationEngine';
export type {
  EasingName,
  Keyframe as ProfessionalKeyframe,
  TrackType,
  AnimationTrack as ProfessionalAnimationTrack,
  SceneGraphNode,
  LightParameters,
  CameraParameters,
  AnimationClip as ProfessionalAnimationClip,
  AnimationPlaybackState,
} from './core/animation/SceneGraphAnimationEngine';

// =============================================================================
// ANIMATION BLENDING & LAYERS
// =============================================================================

export {
  animationBlendingService,
  AnimationBlendingService,
  CAMERA_ANIMATION_PRESETS,
  LIGHT_ANIMATION_PRESETS,
} from './core/animation/AnimationBlendingService';
export type {
  BlendMode,
  AnimationLayer,
  LayerState,
  CrossfadeConfig,
  TransitionState,
  CameraAnimationPreset,
} from './core/animation/AnimationBlendingService';

// =============================================================================
// CURVE EDITOR
// =============================================================================

export {
  CurveEditorCanvas,
  CURVE_PRESETS,
} from './ui/components/CurveEditorCanvas';
export type {
  BezierPoint,
  BezierCurve,
} from './ui/components/CurveEditorCanvas';

// =============================================================================
// ANIMATION UI PANELS
// =============================================================================

export { AnimationLayersPanel } from './ui/panels/AnimationLayersPanel';
export { KeyframeEditor } from './ui/panels/KeyframeEditor';
export { AnimationStudioPanel } from './ui/panels/AnimationStudioPanel';

// =============================================================================
// ANIMATION RECORDING
// =============================================================================

export {
  animationRecorder,
  AnimationRecorder,
  DEFAULT_RECORDING_CONFIG,
} from './core/animation/AnimationRecorder';
export type {
  RecordingConfig,
  RecordingSession,
  RecordedKeyframe,
  RecordingState,
} from './core/animation/AnimationRecorder';

// =============================================================================
// MOTION PATH VISUALIZATION
// =============================================================================

export {
  MotionPath,
  MultiMotionPath,
  CameraPreviewPath,
} from './ui/components/MotionPathVisualization';
export type { MotionPathConfig, MotionPathProps } from './ui/components/MotionPathVisualization';

// =============================================================================
// ANIMATION TEMPLATES
// =============================================================================

export {
  animationTemplateService,
  AnimationTemplateService,
  AnimationTemplateGenerator,
  ANIMATION_TEMPLATES,
} from './core/animation/AnimationTemplates';
export type {
  AnimationStep,
  AnimationTemplate,
  TemplateCategory,
  RequiredNode,
} from './core/animation/AnimationTemplates';

// =============================================================================
// VIDEO EXPORT
// =============================================================================

export {
  videoExportService,
  VideoExportService,
  RESOLUTION_PRESETS,
  QUALITY_PRESETS,
  FPS_PRESETS,
} from './core/animation/VideoExportService';
export type {
  VideoExportConfig,
  ExportProgress,
  ExportResult,
  ProgressCallback,
  FrameRenderCallback,
} from './core/animation/VideoExportService';

export { VideoExportPanel } from './ui/panels/VideoExportPanel';

// =============================================================================
// ANIMATION STATE MANAGER
// =============================================================================

export {
  animationStateManager,
  AnimationStateManager,
} from './core/animation/AnimationStateManager';
export type {
  SceneBinding,
  AnimationState as ManagedAnimationState,
  PropertyUpdate,
  UpdateCallback,
  StateChangeCallback,
} from './core/animation/AnimationStateManager';

// =============================================================================
// MOTION PATH EDITOR 3D
// =============================================================================

export { MotionPathEditor3D } from './ui/components/MotionPathEditor3D';
export type { MotionPathEditor3DProps } from './ui/components/MotionPathEditor3D';

// =============================================================================
// SELECTION HIGHLIGHT
// =============================================================================

export { SelectionHighlight } from './ui/components/SelectionHighlight';

// =============================================================================
// QUICK ACCESS TOOLBAR
// =============================================================================

export { QuickAccessToolbar, MiniToolbar } from './ui/components/QuickAccessToolbar';
export type { TransformMode as ToolbarTransformMode, ViewMode } from './ui/components/QuickAccessToolbar';

// =============================================================================
// ANIMATION BINDING
// =============================================================================

export { useAnimationBinding } from './hooks/useAnimationBinding';
export type {
  SceneObject,
  UseAnimationBindingOptions,
  UseAnimationBindingReturn,
} from './hooks/useAnimationBinding';

// =============================================================================
// GOOGLE DRIVE EXPORT
// =============================================================================

export {
  googleDriveExportService,
  GoogleDriveExportService,
  EXPORT_PRESETS,
} from './core/animation/GoogleDriveExportService';
export type {
  ExportPreset,
  GoogleDriveUploadConfig,
  GoogleDriveUploadProgress,
  GoogleDriveUploadResult,
  UploadProgressCallback,
} from './core/animation/GoogleDriveExportService';

// =============================================================================
// MOTION PATH EDITOR HOOK
// =============================================================================

export { useMotionPathEditor } from './hooks/useMotionPathEditor';
export type {
  MotionPathEditorState,
  UseMotionPathEditorOptions,
  UseMotionPathEditorReturn,
} from './hooks/useMotionPathEditor';

// =============================================================================
// EXPORT SCHEDULER
// =============================================================================

export {
  exportScheduler,
} from './core/animation/ExportScheduler';
export type {
  ExportJob,
  ExportJobStatus,
  ExportJobPriority,
  BatchExportConfig,
  SchedulerState,
  SchedulerStateCallback,
} from './core/animation/ExportScheduler';

export { ExportSchedulerPanel } from './ui/panels/ExportSchedulerPanel';

// =============================================================================
// EXPORT TEMPLATES
// =============================================================================

export {
  exportTemplateService,
  EXPORT_TEMPLATES,
  TEMPLATE_CATEGORIES,
} from './core/animation/ExportTemplates';
export type {
  ExportTemplate,
  ExportTemplateCategory,
  ScheduleConfig,
  ScheduleType,
  TemplateIconName,
  CategoryIconName,
} from './core/animation/ExportTemplates';

export { ExportTemplatesPanel } from './ui/panels/ExportTemplatesPanel';

// =============================================================================
// PROJECT MANAGEMENT
// =============================================================================

export {
  ProjectManagerPanel,
  SaveProjectDialog,
  LoadProjectDialog,
  RecentProjectsDropdown,
  AutoSaveIndicator,
} from './ui/panels/ProjectManagerPanel';
export type { VirtualStudioProject } from './ui/panels/ProjectManagerPanel';

// =============================================================================
// SHOT LIST INTEGRATION
// =============================================================================

export {
  ShotListIntegrationPanel,
} from './ui/panels/ShotListIntegrationPanel';
export type {
  Shot,
  VirtualStudioSetup,
  ShotListIntegrationProps,
} from './ui/panels/ShotListIntegrationPanel';

// =============================================================================
// STORYBOARD SYSTEM
// =============================================================================

export { StoryboardPanel } from './ui/panels/StoryboardPanel';
export { FrameEditorPanel } from './ui/panels/FrameEditorPanel';
export { StoryboardTimeline } from './ui/components/StoryboardTimeline';
export { AnimaticPlayer, AnimaticPlayerDialog } from './ui/components/AnimaticPlayer';
export type { TransitionType } from './ui/components/AnimaticPlayer';
export { StoryboardExportDialog } from './ui/components/StoryboardExportDialog';
export { storyboardCaptureService } from './core/storyboard/StoryboardCaptureService';
export { storyboardExportService, StoryboardExportService } from './core/storyboard/StoryboardExportService';
export type {
  ExportFormat,
  ExportOptions,
  ExportProgress as StoryboardExportProgress,
  ExportResult as StoryboardExportResult,
} from './core/storyboard/StoryboardExportService';

// Collaboration
export { 
  storyboardCollaborationService, 
  StoryboardCollaborationService,
} from './core/storyboard/StoryboardCollaborationService';
export type {
  Comment,
  CommentStatus,
  CommentAttachment,
  VersionSnapshot,
  ShareLink as CollaborationShareLink,
  TeamMember,
  PermissionLevel,
  ActiveCollaborator,
  CollaborationState,
  CollaborationEvent,
  CollaborationEventType,
} from './core/storyboard/StoryboardCollaborationService';

export { StoryboardCommentsPanel } from './ui/components/StoryboardCommentsPanel';
export { StoryboardVersionHistory } from './ui/components/StoryboardVersionHistory';
export { StoryboardSharingDialog } from './ui/components/StoryboardSharingDialog';
export { FrameContextMenu } from './ui/components/FrameContextMenu';
export type { QuickAnnotationType } from './ui/components/FrameContextMenu';

// Interactive Annotations
export { FrameAnnotationOverlay } from './ui/components/FrameAnnotationOverlay';
export type { FrameAnnotation, AnnotationType } from './ui/components/FrameAnnotationOverlay';
export { InteractiveFrameViewer } from './ui/components/InteractiveFrameViewer';

// Quick Annotation (legacy - for baking into images)
export { quickAnnotationService, QuickAnnotationService } from './core/storyboard/QuickAnnotationService';
export type { AnnotationObject, QuickAnnotationConfig } from './core/storyboard/QuickAnnotationService';

// =============================================================================
// STORYBOARD ANIMATIONS
// =============================================================================

// Animation Keyframes & Utilities
export {
  // Entry/Exit
  scaleInSpring,
  scaleOutFade,
  slideInRight,
  slideOutLeft,
  popIn,
  fadeInUp,
  // Interaction
  hoverLift,
  ripple,
  dragTiltRight,
  dragTiltLeft,
  selectionRing,
  subtleBounce,
  // State Transitions
  approvalBurst,
  approvalPulse,
  revisionShake,
  editGlow,
  lockWiggle,
  colorMorph,
  // Path Animations
  arrowFlow,
  cameraDolly,
  lightRays,
  focusBreathe,
  glowPulse,
  // Timeline
  cardFlip,
  playheadPulse,
  durationStretch,
  staggerFadeIn,
  // Micro-interactions
  buttonPress,
  toggleSwitch,
  sliderBounce,
  tooltipAppear,
  checkmarkDraw,
  spinnerRotate,
  // Utilities
  animationDurations,
  animationEasings,
  getStaggerDelay,
  createAnimation,
} from './ui/animations/storyboardAnimations';

// Animated Components
export { AnimatedFrameCard } from './ui/components/AnimatedFrameCard';
export type { AnimatedFrameCardProps, FrameStatus as AnimatedFrameStatus } from './ui/components/AnimatedFrameCard';

export { AnimatedTimeline } from './ui/components/AnimatedTimeline';
export type { AnimatedTimelineProps, TimelineFrame } from './ui/components/AnimatedTimeline';

export {
  AnimatedButton,
  AnimatedIconButton,
  AnimatedSwitch,
  AnimatedTooltip,
  AnimatedCheckmark,
  AnimatedSpinner,
  SuccessBurst,
  AnimatedSlider,
  AnimatedBadge,
  StaggerContainer,
} from './ui/components/MicroInteractions';
export type {
  AnimatedButtonProps,
  AnimatedIconButtonProps,
  AnimatedBadgeProps,
} from './ui/components/MicroInteractions';

// =============================================================================
// DEVICE DETECTION
// =============================================================================

export {
  useDeviceDetection,
  getDeviceInfo,
  isTabletDevice,
  prefersTouchUI,
} from './hooks/useDeviceDetection';
export type {
  DeviceType,
  PointerType,
  Orientation,
  DeviceInfo,
} from './hooks/useDeviceDetection';

// =============================================================================
// TOUCH GESTURES (iPad/Tablet Support)
// =============================================================================

export {
  useTouchGestures,
  usePinchZoom,
  useSwipeNavigation,
  useLongPressMenu,
} from './hooks/useTouchGestures';
export type {
  Point as TouchPoint,
  GestureState,
  SwipeDirection,
  TouchGestureCallbacks,
  UseTouchGesturesOptions,
  UseTouchGesturesReturn,
  UsePinchZoomOptions,
  UsePinchZoomReturn,
  UseSwipeNavigationOptions,
  UseLongPressMenuOptions,
} from './hooks/useTouchGestures';

// Touch-optimized components
export { TouchFrameViewer } from './ui/components/TouchFrameViewer';
export type { TouchFrameViewerProps } from './ui/components/TouchFrameViewer';

export { TouchTimeline } from './ui/components/TouchTimeline';
export type { TouchTimelineProps, TimelineFrame as TouchTimelineFrame } from './ui/components/TouchTimeline';

// =============================================================================
// APPLE PENCIL SUPPORT
// =============================================================================

export {
  useApplePencil,
  drawPressureStroke,
  drawTiltStroke,
} from './hooks/useApplePencil';
export type {
  PencilPoint,
  PencilStroke,
  InputType,
  PencilState,
  PencilCallbacks,
  UseApplePencilOptions,
  UseApplePencilReturn,
} from './hooks/useApplePencil';

export { PencilCanvas } from './ui/components/PencilCanvas';
export type { PencilCanvasProps, BrushType, BrushSettings } from './ui/components/PencilCanvas';

// =============================================================================
// TABLET SUPPORT PROVIDER & CONTEXT
// =============================================================================

export {
  TabletSupportProvider,
  useTabletSupport,
  withTabletSupport,
  TabletOnly,
  DesktopOnly,
  PencilOnly,
  ResponsiveRender,
} from './providers/TabletSupportProvider';
export type {
  LayoutMode,
  InteractionMode,
  PanelPosition,
  TabletLayout,
  GestureConfig,
  TabletSupportContextValue,
  TabletSupportProviderProps,
  WithTabletSupportProps,
  ResponsiveRenderProps,
} from './providers/TabletSupportProvider';

// =============================================================================
// TABLET UI COMPONENTS
// =============================================================================

export {
  TabletButton,
  TabletIconButton,
  TabletSlider,
  TabletToolbar,
  TabletSidebar,
  TabletBottomSheet,
  TabletContextMenu,
  GestureView,
} from './ui/components/TabletUI';
export type {
  TabletButtonProps,
  TabletIconButtonProps,
  TabletSliderProps,
  TabletToolbarProps,
  TabletSidebarProps,
  TabletBottomSheetProps,
  TabletContextMenuProps,
  ContextMenuItem,
  GestureViewProps,
} from './ui/components/TabletUI';

// =============================================================================
// TABLET-AWARE PANEL COMPONENTS
// =============================================================================

export {
  TouchSlider,
  TouchIconButton,
  TouchDraggable,
  TouchTimelineScrubber,
  TouchContextMenu,
  TouchSwipeListItem,
  TouchPinchZoom,
} from './ui/components/TabletAwarePanels';

// =============================================================================
// ACCESSIBILITY PROVIDER (WCAG 2.2)
// =============================================================================

export {
  AccessibilityProvider,
  useAccessibility,
  useKeyboardNavigation,
  useFocusTrap,
  useKeyboardShortcut,
  useAnnounce,
  VisuallyHidden,
  LiveRegion,
} from './providers/AccessibilityProvider';
export type {
  AccessibilitySettings,
  FocusTrapConfig,
  Announcement,
  KeyboardShortcut,
  AccessibilityContextValue,
} from './providers/AccessibilityProvider';

// =============================================================================
// ACCESSIBLE UI COMPONENTS (WCAG 2.2)
// =============================================================================

export {
  AccessibleButton,
  AccessibleIconButton,
  AccessibleSlider,
  AccessibleTabs,
  AccessibleDialog,
  AccessibleDraggable,
  AccessibleList,
  AccessibleTooltip,
  AccessibleProgress,
} from './ui/components/AccessibleComponents';

// =============================================================================
// ACCESSIBLE 3D CONTROLS (WCAG 2.5.7)
// =============================================================================

export { Accessible3DControls } from './ui/components/Accessible3DControls';
export type {
  Camera3DState,
  Object3DState,
  Accessible3DControlsProps,
} from './ui/components/Accessible3DControls';

// =============================================================================
// VIRTUAL STUDIO LAYOUT (Tablet-optimized)
// =============================================================================

export {
  VirtualStudioLayout,
} from './ui/layout/VirtualStudioLayout';
export type {
  VirtualStudioLayoutProps,
} from './ui/layout/VirtualStudioLayout';

// Storyboard Database API
export {
  storyboardApi,
  storyboardsApi,
  framesApi,
  commentsApi,
  versionsApi,
  teamApi,
  shareLinksApi,
} from './core/api/storyboardApi';
export type {
  StoryboardDB,
  StoryboardFrameDB,
  StoryboardCommentDB,
  StoryboardVersionDB,
  StoryboardTeamMemberDB,
  StoryboardShareLinkDB,
} from './core/api/storyboardApi';
export { 
  FrameCanvasEngine, 
  frameCanvasEngine,
  DEFAULT_STYLE,
  MARKER_COLORS,
} from './core/storyboard/FrameCanvasEngine';
export type {
  ToolType,
  Point as CanvasPoint,
  DrawingStyle,
  CanvasObject,
  CanvasState,
} from './core/storyboard/FrameCanvasEngine';
export {
  useStoryboardStore,
  useCurrentStoryboard,
  useStoryboards,
  useSelectedFrame,
  useStoryboardSettings,
  useIsCapturing,
  useViewMode,
  getShotTypeLabel,
  getShotTypeColor,
  calculateTotalDuration,
  formatDuration,
} from './state/storyboardStore';
export type {
  Storyboard,
  StoryboardFrame,
  StoryboardSettings,
  ShotType,
  CameraAngle,
  CameraMovement,
  FrameStatus,
  SceneSnapshot,
  CapturedCameraState,
  CapturedLightState,
} from './state/storyboardStore';

// =============================================================================
// ERROR HANDLER
// =============================================================================

export { errorHandler, handleError, handleWarning } from './core/services/errorHandler';

// =============================================================================
// CLIENT SHARING SYSTEM
// =============================================================================

export {
  clientSharingService,
} from './core/services/clientSharingService';
export type {
  ShareLink as ClientShareLink,
  SharePermissions,
  ClientComment,
  ApprovalStatus,
  ShareAnalytics,
} from './core/services/clientSharingService';

export { ClientSharingPanel } from './ui/panels/ClientSharingPanel';
export { ClientView } from './ui/features/ClientView';

// =============================================================================
// IMPORT DIALOG
// =============================================================================

export { ImportDialog } from './ui/dialogs/ImportDialog';

// =============================================================================
// 3D SCENE COMPONENTS (STAGE3D)
// =============================================================================

export { default as Lights } from './ui/stage3d/Lights';
export { default as CameraRig } from './ui/stage3d/CameraRig';
export { default as SceneNodes } from './ui/stage3d/SceneNodes';

// =============================================================================
// DATABASE API
// =============================================================================

export { virtualStudioApi } from './core/api/virtualStudioApi';
export {
  exportTemplatesApi,
  exportJobsApi,
  animationClipsApi,
  preferencesApi,
  equipmentGroupsApi,
  snapshotsApi,
} from './core/api/virtualStudioApi';
export type {
  ExportTemplateDB,
  ExportJobDB,
  AnimationClipDB,
  UserPreferencesDB,
  EquipmentGroupDB,
  SceneSnapshotDB,
} from'./core/api/virtualStudioApi';
