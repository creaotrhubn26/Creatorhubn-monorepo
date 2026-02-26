/**
 * Storyboard Store
 * 
 * Zustand store for managing storyboards and frames
 */

import { create } from 'zustand';
import type { ShotType, CameraAngle, CameraMovement } from '../models/casting';
export type { ShotType, CameraAngle, CameraMovement };

// Types
export type FrameStatus = 'draft' | 'pending' | 'approved' | 'revision';

export interface FrameAnnotationData {
  id: string;
  type: 'arrow' | 'circle' | 'rectangle' | 'line' | 'text' | 'focus';
  x: number;
  y: number;
  rotation?: number;
  label?: string;
  notes?: string;
  color?: string;
  isNew?: boolean;
  createdAt: string;
}

export type FrameImageSource = 'ai' | 'captured' | 'drawn' | 'uploaded';

export interface ConceptArtIntentData {
  sceneIntent: string;
  environment: string;
  mood: string;
  timeOfDay: string;
  style: string;
  camera: string;
  notes: string;
  template: string;
  prompt: string;
  generatedAt?: string;
}

export interface ConceptArtVariantData {
  id: string;
  imageUrl: string;
  prompt: string;
  source: 'ai' | 'fallback';
  model?: string;
  createdAt: string;
  error?: string;
}

export interface FrameConceptArtData {
  intent: ConceptArtIntentData;
  variants: ConceptArtVariantData[];
  selectedVariantId: string | null;
  lastGeneratedAt?: string;
}

export type CinematographyShotSize = 'EWS' | 'WS' | 'MS' | 'CU' | 'ECU';

export interface FrameCinematographyData {
  shotSize: CinematographyShotSize;
  lensMm: number;
  apertureFStop: number;
  cameraHeightCm: number;
  angle: CameraAngle;
  movement: CameraMovement;
  frameRate: 23.976 | 24 | 25 | 30 | 48 | 60;
  aspectRatio: '16:9' | '4:3' | '2.35:1' | '2.39:1' | '1:1' | '9:16';
  keyLightDirection: number; // 0-360 degrees
  keyLightIntensity: number; // 0-1
}

export interface FrameOverlayData {
  ruleOfThirds: boolean;
  safeAreas: boolean;
  showTitleSafe: boolean;
  showActionSafe: boolean;
  grid: boolean;
  eyelineMatch: boolean;
  centerCross: boolean;
  perspectiveGrid: boolean;
  perspectiveSnap: boolean;
  vanishingPoints: boolean;
  lensFalloff: boolean;
  lightingVector: boolean;
  opacity: number;
}

export interface FrameScriptLinkData {
  source: 'manual' | 'fountain' | 'final-draft' | 'celtx';
  sceneNumber: string;
  dialogueReference: string;
  versionTag: string;
  versionCompareSummary: string;
  scriptLineStart: number | null;
  scriptLineEnd: number | null;
}

export interface FrameProductionPlanData {
  shootingDay: string;
  location: string;
  cast: string[];
  shotStatus: 'planned' | 'scheduled' | 'shooting' | 'completed' | 'approved';
  completionNotes: string;
}

export type StoryboardDepartment = 'director' | 'dp' | 'ad' | 'producer' | 'art' | 'vfx' | 'post';
export type FrameApprovalStatus = 'pending' | 'approved' | 'changes-requested';
export type ScreenDirection = 'ltr' | 'rtl' | 'neutral';

export interface FrameContinuityData {
  intentBefore: string;
  intentAfter: string;
  characterStateBefore: string;
  characterStateAfter: string;
  propStateBefore: string;
  propStateAfter: string;
  wardrobeStateBefore: string;
  wardrobeStateAfter: string;
  screenDirection: ScreenDirection;
  eyelineTarget: string;
  riskFactors: string[];
  continuityScore: number;
}

export interface FrameCoverageData {
  beatGoals: string[];
  emotionalBeat: string;
  continuityBeat: string;
  hasWide: boolean;
  hasMedium: boolean;
  hasClose: boolean;
  hasInsert: boolean;
  hasCutaway: boolean;
  hasMove: boolean;
  coverageScore: number;
  gapNotes: string;
}

export interface FrameDepartmentViewsData {
  activeDepartment: StoryboardDepartment;
  notesByDepartment: Record<StoryboardDepartment, string>;
  readyByDepartment: Record<StoryboardDepartment, boolean>;
  blockersByDepartment: Record<StoryboardDepartment, string>;
}

export interface FrameApprovalData {
  statusByDepartment: Record<StoryboardDepartment, FrameApprovalStatus>;
  signOffNames: string[];
  lockAfterApproval: boolean;
  latestDiffSummary: string;
}

export interface FrameDecisionVersionData {
  id: string;
  label: string;
  createdAt: string;
  summary: string;
  shotSize: CinematographyShotSize;
  lensMm: number;
  frameTimingMs: number;
  shotStatus: FrameProductionPlanData['shotStatus'];
}

export interface FrameVersioningData {
  currentVersionLabel: string;
  compareWithVersionId: string | null;
  versions: FrameDecisionVersionData[];
}

export interface FrameHandoffData {
  includePdfBoardBook: boolean;
  includeAnimaticVideo: boolean;
  includeShotListCsv: boolean;
  includeCallSheetIntegration: boolean;
  includeCameraData3D: boolean;
  includeEditReference: boolean;
  lastExportedAt: string | null;
  deliveryNotes: string;
  completionTracking: {
    prep: boolean;
    shoot: boolean;
    post: boolean;
  };
}

export interface FrameAnimaticVersionData {
  id: string;
  name: string;
  timingMs: number;
  notes: string;
  createdAt: string;
}

export interface FrameAnimaticData {
  frameTimingMs: number;
  motionArrows: boolean;
  cameraMoveSimulation: boolean;
  pacingPreview: boolean;
  soundMarkers: string;
  dialogueAudioCue: string;
  tempMusicCue: string;
  leadInMs: number;
  leadOutMs: number;
  transitionType: 'cut' | 'dissolve' | 'fade';
  cameraMoveCurve: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  cutVariant: 'director' | 'producer' | 'edit';
  selectedVersionId: string | null;
  versions: FrameAnimaticVersionData[];
}

export interface FrameDecisionData {
  cinematography: FrameCinematographyData;
  overlays: FrameOverlayData;
  script: FrameScriptLinkData;
  production: FrameProductionPlanData;
  continuity: FrameContinuityData;
  coverage: FrameCoverageData;
  animatic: FrameAnimaticData;
  departmentViews: FrameDepartmentViewsData;
  approvals: FrameApprovalData;
  versioning: FrameVersioningData;
  handoff: FrameHandoffData;
  updatedAt?: string;
}

const DEFAULT_DEPARTMENT_NOTES: Record<StoryboardDepartment, string> = {
  director: '',
  dp: '',
  ad: '',
  producer: '',
  art: '',
  vfx: '',
  post: '',
};

const DEFAULT_DEPARTMENT_READY: Record<StoryboardDepartment, boolean> = {
  director: false,
  dp: false,
  ad: false,
  producer: false,
  art: false,
  vfx: false,
  post: false,
};

const DEFAULT_APPROVAL_STATUS: Record<StoryboardDepartment, FrameApprovalStatus> = {
  director: 'pending',
  dp: 'pending',
  ad: 'pending',
  producer: 'pending',
  art: 'pending',
  vfx: 'pending',
  post: 'pending',
};

export const DEFAULT_FRAME_DECISION_DATA: FrameDecisionData = {
  cinematography: {
    shotSize: 'MS',
    lensMm: 35,
    apertureFStop: 2.8,
    cameraHeightCm: 160,
    angle: 'Eye Level',
    movement: 'Static',
    frameRate: 24,
    aspectRatio: '16:9',
    keyLightDirection: 315,
    keyLightIntensity: 0.45,
  },
  overlays: {
    ruleOfThirds: true,
    safeAreas: false,
    showTitleSafe: false,
    showActionSafe: false,
    grid: false,
    eyelineMatch: false,
    centerCross: false,
    perspectiveGrid: false,
    perspectiveSnap: false,
    vanishingPoints: false,
    lensFalloff: false,
    lightingVector: false,
    opacity: 0.35,
  },
  script: {
    source: 'manual',
    sceneNumber: '',
    dialogueReference: '',
    versionTag: '',
    versionCompareSummary: '',
    scriptLineStart: null,
    scriptLineEnd: null,
  },
  production: {
    shootingDay: '',
    location: '',
    cast: [],
    shotStatus: 'planned',
    completionNotes: '',
  },
  continuity: {
    intentBefore: '',
    intentAfter: '',
    characterStateBefore: '',
    characterStateAfter: '',
    propStateBefore: '',
    propStateAfter: '',
    wardrobeStateBefore: '',
    wardrobeStateAfter: '',
    screenDirection: 'neutral',
    eyelineTarget: '',
    riskFactors: [],
    continuityScore: 0,
  },
  coverage: {
    beatGoals: [],
    emotionalBeat: '',
    continuityBeat: '',
    hasWide: false,
    hasMedium: false,
    hasClose: false,
    hasInsert: false,
    hasCutaway: false,
    hasMove: false,
    coverageScore: 0,
    gapNotes: '',
  },
  animatic: {
    frameTimingMs: 2000,
    motionArrows: true,
    cameraMoveSimulation: false,
    pacingPreview: true,
    soundMarkers: '',
    dialogueAudioCue: '',
    tempMusicCue: '',
    leadInMs: 0,
    leadOutMs: 0,
    transitionType: 'cut',
    cameraMoveCurve: 'linear',
    cutVariant: 'director',
    selectedVersionId: null,
    versions: [],
  },
  departmentViews: {
    activeDepartment: 'director',
    notesByDepartment: { ...DEFAULT_DEPARTMENT_NOTES },
    readyByDepartment: { ...DEFAULT_DEPARTMENT_READY },
    blockersByDepartment: { ...DEFAULT_DEPARTMENT_NOTES },
  },
  approvals: {
    statusByDepartment: { ...DEFAULT_APPROVAL_STATUS },
    signOffNames: [],
    lockAfterApproval: false,
    latestDiffSummary: '',
  },
  versioning: {
    currentVersionLabel: 'v1',
    compareWithVersionId: null,
    versions: [],
  },
  handoff: {
    includePdfBoardBook: true,
    includeAnimaticVideo: true,
    includeShotListCsv: true,
    includeCallSheetIntegration: false,
    includeCameraData3D: false,
    includeEditReference: true,
    lastExportedAt: null,
    deliveryNotes: '',
    completionTracking: {
      prep: false,
      shoot: false,
      post: false,
    },
  },
};

export function calculateContinuityScore(continuity: FrameContinuityData): number {
  const positiveSignals = [
    continuity.intentBefore,
    continuity.intentAfter,
    continuity.characterStateBefore,
    continuity.characterStateAfter,
    continuity.propStateBefore,
    continuity.propStateAfter,
    continuity.wardrobeStateBefore,
    continuity.wardrobeStateAfter,
    continuity.eyelineTarget,
  ].filter((value) => value.trim().length > 0).length;
  const baseScore = Math.round((positiveSignals / 9) * 100);
  const directionBonus = continuity.screenDirection === 'neutral' ? 0 : 8;
  const riskPenalty = Math.min(continuity.riskFactors.length * 8, 40);
  return Math.max(0, Math.min(100, baseScore + directionBonus - riskPenalty));
}

export function calculateCoverageScore(coverage: FrameCoverageData): number {
  const points = [
    coverage.hasWide,
    coverage.hasMedium,
    coverage.hasClose,
    coverage.hasInsert,
    coverage.hasCutaway,
    coverage.hasMove,
  ].filter(Boolean).length;
  return Math.round((points / 6) * 100);
}

export function cloneFrameDecisionData(data: FrameDecisionData): FrameDecisionData {
  return {
    cinematography: {
      ...DEFAULT_FRAME_DECISION_DATA.cinematography,
      ...data.cinematography,
    },
    overlays: {
      ...DEFAULT_FRAME_DECISION_DATA.overlays,
      ...data.overlays,
    },
    script: { ...data.script },
    production: {
      ...data.production,
      cast: [...data.production.cast],
    },
    continuity: {
      ...data.continuity,
      riskFactors: [...data.continuity.riskFactors],
    },
    coverage: {
      ...data.coverage,
      beatGoals: [...data.coverage.beatGoals],
    },
    animatic: {
      ...data.animatic,
      versions: data.animatic.versions.map((version) => ({ ...version })),
    },
    departmentViews: {
      ...data.departmentViews,
      notesByDepartment: { ...data.departmentViews.notesByDepartment },
      readyByDepartment: { ...data.departmentViews.readyByDepartment },
      blockersByDepartment: { ...data.departmentViews.blockersByDepartment },
    },
    approvals: {
      ...data.approvals,
      statusByDepartment: { ...data.approvals.statusByDepartment },
      signOffNames: [...data.approvals.signOffNames],
    },
    versioning: {
      ...data.versioning,
      versions: data.versioning.versions.map((version) => ({ ...version })),
    },
    handoff: {
      ...data.handoff,
      completionTracking: { ...data.handoff.completionTracking },
    },
    updatedAt: data.updatedAt,
  };
}

export interface FrameDrawingData {
  dataUrl: string; // Base64 canvas export
  strokes?: string; // JSON stringified stroke data for replay
  brushSettings?: {
    type: string;
    size: number;
    color: string;
    opacity: number;
  };
  deviceType?: 'pencil' | 'touch' | 'mouse';
  conceptArt?: FrameConceptArtData;
  decisionData?: FrameDecisionData;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardFrame {
  id: string;
  index: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  drawingData?: FrameDrawingData; // iPad drawing data
  imageSource?: FrameImageSource; // How the image was created
  title: string;
  description?: string;
  shotType: ShotType;
  cameraAngle: CameraAngle;
  cameraMovement: CameraMovement;
  duration: number; // seconds
  status: FrameStatus;
  sceneSnapshot?: {
    camera: {
      position: [number, number, number];
      rotation: [number, number, number];
      focalLength: number;
      aperture: number;
    };
    lights: Array<{
      id: string;
      type: string;
      position: [number, number, number];
      intensity: number;
    }>;
  };
  annotations?: FrameAnnotationData[];
  createdAt: string;
  updatedAt: string;
}

export interface Storyboard {
  id: string;
  name: string;
  aspectRatio: '16:9' | '4:3' | '2.35:1' | '1:1' | '9:16';
  frames: StoryboardFrame[];
  createdAt: string;
  updatedAt: string;
}

interface StoryboardState {
  storyboards: Storyboard[];
  currentStoryboardId: string | null;
  selectedFrameId: string | null;
  isCapturing: boolean;
  viewMode: 'grid' | 'timeline' | 'carousel' | 'single';
  settings: {
    defaultDuration: number;
    playbackSpeed: number;
    transitionDuration: number;
    defaultShotType: ShotType;
    showTechnicalInfo: boolean;
  };

  // Actions
  createStoryboard: (name: string, aspectRatio: Storyboard['aspectRatio']) => void;
  loadStoryboard: (id: string) => void;
  deleteStoryboard: (id: string) => void;
  addFrame: (frame: Omit<StoryboardFrame, 'id' | 'index' | 'createdAt' | 'updatedAt'>) => void;
  updateFrame: (frameId: string, updates: Partial<StoryboardFrame>) => void;
  deleteFrame: (frameId: string) => void;
  selectFrame: (frameId: string | null) => void;
  setCapturing: (isCapturing: boolean) => void;
  setViewMode: (mode: 'grid' | 'timeline' | 'carousel' | 'single') => void;
  addAnnotation: (frameId: string, annotation: Omit<FrameAnnotationData, 'id' | 'createdAt'>) => void;
  updateAnnotation: (frameId: string, annotationId: string, updates: Partial<FrameAnnotationData>) => void;
  deleteAnnotation: (frameId: string, annotationId: string) => void;
}

export const useStoryboardStore = create<StoryboardState>((set, get) => ({
  storyboards: [],
  currentStoryboardId: null,
  selectedFrameId: null,
  isCapturing: false,
  viewMode: 'grid',
  settings: {
    defaultDuration: 3,
    playbackSpeed: 1,
    transitionDuration: 0.5,
    defaultShotType: 'Wide',
    showTechnicalInfo: true,
  },

  createStoryboard: (name, aspectRatio) => {
    const newStoryboard: Storyboard = {
      id: `storyboard-${Date.now()}`,
      name,
      aspectRatio,
      frames: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      storyboards: [...state.storyboards, newStoryboard],
      currentStoryboardId: newStoryboard.id,
    }));
  },

  loadStoryboard: (id) => {
    set({ currentStoryboardId: id, selectedFrameId: null });
  },

  deleteStoryboard: (id) => {
    set((state) => {
      const newStoryboards = state.storyboards.filter((sb) => sb.id !== id);
      return {
        storyboards: newStoryboards,
        currentStoryboardId: state.currentStoryboardId === id 
          ? (newStoryboards.length > 0 ? newStoryboards[0].id : null)
          : state.currentStoryboardId,
      };
    });
  },

  addFrame: (frameData) => {
    const state = get();
    const currentStoryboard = state.storyboards.find((sb) => sb.id === state.currentStoryboardId);
    if (!currentStoryboard) return;

    const newFrame: StoryboardFrame = {
      ...frameData,
      id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      index: currentStoryboard.frames.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      annotations: frameData.annotations || [],
    };

    set((state) => ({
      storyboards: state.storyboards.map((sb) =>
        sb.id === state.currentStoryboardId
          ? {
              ...sb,
              frames: [...sb.frames, newFrame],
              updatedAt: new Date().toISOString(),
            }
          : sb
      ),
    }));
  },

  updateFrame: (frameId, updates) => {
    set((state) => ({
      storyboards: state.storyboards.map((sb) =>
        sb.id === state.currentStoryboardId
          ? {
              ...sb,
              frames: sb.frames.map((frame) =>
                frame.id === frameId
                  ? { ...frame, ...updates, updatedAt: new Date().toISOString() }
                  : frame
              ),
              updatedAt: new Date().toISOString(),
            }
          : sb
      ),
    }));
  },

  deleteFrame: (frameId) => {
    set((state) => ({
      storyboards: state.storyboards.map((sb) =>
        sb.id === state.currentStoryboardId
          ? {
              ...sb,
              frames: sb.frames
                .filter((frame) => frame.id !== frameId)
                .map((frame, index) => ({ ...frame, index })),
              updatedAt: new Date().toISOString(),
            }
          : sb
      ),
      selectedFrameId: state.selectedFrameId === frameId ? null : state.selectedFrameId,
    }));
  },

  selectFrame: (frameId) => {
    set({ selectedFrameId: frameId });
  },

  setCapturing: (isCapturing) => {
    set({ isCapturing });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  addAnnotation: (frameId, annotationData) => {
    const annotation: FrameAnnotationData = {
      ...annotationData,
      id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      storyboards: state.storyboards.map((sb) =>
        sb.id === state.currentStoryboardId
          ? {
              ...sb,
              frames: sb.frames.map((frame) =>
                frame.id === frameId
                  ? {
                      ...frame,
                      annotations: [...(frame.annotations || []), annotation],
                      updatedAt: new Date().toISOString(),
                    }
                  : frame
              ),
              updatedAt: new Date().toISOString(),
            }
          : sb
      ),
    }));
  },

  updateAnnotation: (frameId, annotationId, updates) => {
    set((state) => ({
      storyboards: state.storyboards.map((sb) =>
        sb.id === state.currentStoryboardId
          ? {
              ...sb,
              frames: sb.frames.map((frame) =>
                frame.id === frameId
                  ? {
                      ...frame,
                      annotations: (frame.annotations || []).map((ann) =>
                        ann.id === annotationId ? { ...ann, ...updates } : ann
                      ),
                      updatedAt: new Date().toISOString(),
                    }
                  : frame
              ),
              updatedAt: new Date().toISOString(),
            }
          : sb
      ),
    }));
  },

  deleteAnnotation: (frameId, annotationId) => {
    set((state) => ({
      storyboards: state.storyboards.map((sb) =>
        sb.id === state.currentStoryboardId
          ? {
              ...sb,
              frames: sb.frames.map((frame) =>
                frame.id === frameId
                  ? {
                      ...frame,
                      annotations: (frame.annotations || []).filter(
                        (ann) => ann.id !== annotationId
                      ),
                      updatedAt: new Date().toISOString(),
                    }
                  : frame
              ),
              updatedAt: new Date().toISOString(),
            }
          : sb
      ),
    }));
  },
}));

// Selector hooks
export const useCurrentStoryboard = () =>
  useStoryboardStore((state) =>
    state.storyboards.find((sb) => sb.id === state.currentStoryboardId) || null
  );

export const useStoryboards = () => useStoryboardStore((state) => state.storyboards);

export const useSelectedFrame = () =>
  useStoryboardStore((state) => {
    const currentStoryboard = state.storyboards.find(
      (sb) => sb.id === state.currentStoryboardId
    );
    if (!currentStoryboard || !state.selectedFrameId) return null;
    return currentStoryboard.frames.find((f) => f.id === state.selectedFrameId) || null;
  });

export const useIsCapturing = () => useStoryboardStore((state) => state.isCapturing);

export const useViewMode = () => useStoryboardStore((state) => state.viewMode);

// Helper functions
export function getShotTypeLabel(type: ShotType): string {
  const labels: Record<ShotType, string> = {
    'Wide': 'Wide',
    'Medium': 'Medium',
    'Close-up': 'Close-up',
    'Extreme Close-up': 'Extreme Close-up',
    'Establishing': 'Establishing',
    'Detail': 'Detail',
    'Two Shot': 'Two Shot',
    'Over Shoulder': 'Over Shoulder',
    'Point of View': 'Point of View',
  };
  return labels[type] || type;
}

export function getShotTypeColor(type: ShotType): string {
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
}

export function calculateTotalDuration(frames: StoryboardFrame[]): number {
  return frames.reduce((total, frame) => total + frame.duration, 0);
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
}
