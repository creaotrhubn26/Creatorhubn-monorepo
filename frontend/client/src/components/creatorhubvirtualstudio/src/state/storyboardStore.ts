/**
 * Storyboard Store - Zustand state management for storyboard system
 * 
 * This is a NATIVE Virtual Studio feature for capturing 3D scene frames
 * into professional storyboards.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// Types
// =============================================================================

export type ShotType = 
  | 'ECU' | 'BCU' | 'CU' | 'MCU' | 'MS' | 'MLS' | 'LS' | 'VLS' | 'ELS'
  | 'OTS' | 'POV' | 'Insert' | 'Cutaway' | 'Two-Shot' | 'Three-Shot' | 'Group'
  | 'Establishing' | 'Master' | 'Coverage' | 'Reaction' | 'Aerial' | 'Macro';

export type CameraAngle = 
  | 'Eye Level' | 'High Angle' | 'Low Angle' | 'Birds Eye' 
  | 'Worms Eye' | 'Dutch Angle' | 'Overhead' | 'Ground Level';

export type CameraMovement = 
  | 'Static' | 'Pan' | 'Tilt' | 'Dolly' | 'Truck' | 'Pedestal'
  | 'Crane' | 'Jib' | 'Handheld' | 'Steadicam' | 'Gimbal'
  | 'Zoom' | 'Push In' | 'Pull Out' | 'Rack Focus' | 'Arc' | 'Orbit';

export type FrameStatus = 'draft' | 'review' | 'approved' | 'revision_needed';

export type AnnotationType = 'arrow' | 'actor' | 'camera' | 'light' | 'focus';

export interface FrameAnnotationData {
  id: string;
  type: AnnotationType;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  rotation?: number;
  label?: string;
  notes?: string;
  color?: string;
  createdAt: string;
  isNew?: boolean;
}

export interface CapturedCameraState {
  position: [number, number, number];
  rotation: [number, number, number];
  fov: number;
  focalLength: number;
  aperture: number;
  focusDistance: number;
  iso: number;
  shutter: number;
}

export interface CapturedLightState {
  id: string;
  name: string;
  type: string;
  position: [number, number, number];
  power: number;
  colorTemperature: number;
  modifier?: string;
}

export interface SceneSnapshot {
  camera: CapturedCameraState;
  lights: CapturedLightState[];
  equipment: string[];
  backdrop?: string;
  props: string[];
  hdriEnvironment?: string;
  cameraSettings?: {
    focalLength: number;
    aperture: string;
    iso: number;
    shutterSpeed: string;
    sensorSize: string;
  };
  tags?: string[];
  importedData?: Record<string, unknown>;
  capturedAt: string;
}

export interface StoryboardFrame {
  id: string;
  storyboardId: string;
  index: number;
  
  // Visual
  imageUrl: string;
  thumbnailUrl: string;
  
  // Shot info
  title: string;
  shotType: ShotType;
  cameraAngle: CameraAngle;
  cameraMovement: CameraMovement;
  
  // Timing
  duration: number; // seconds
  
  // Notes
  description?: string;
  technicalNotes?: string;
  dialogue?: string;
  
  // Annotations (interactive overlay)
  annotations?: FrameAnnotationData[];
  
  // Scene state (for bi-directional sync)
  sceneSnapshot?: SceneSnapshot;
  
  // Status
  status: FrameStatus;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface Storyboard {
  id: string;
  name: string;
  description?: string;
  aspectRatio: '16:9' | '4:3' | '2.35:1' | '1:1' | '9:16';
  frames: StoryboardFrame[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardSettings {
  defaultDuration: number;
  defaultShotType: ShotType;
  showTimecodes: boolean;
  showTechnicalInfo: boolean;
  gridColumns: 2 | 3 | 4 | 6;
  autoSave: boolean;
}

// =============================================================================
// Store State
// =============================================================================

interface StoryboardState {
  // Current storyboard
  currentStoryboard: Storyboard | null;
  
  // All storyboards
  storyboards: Storyboard[];
  
  // Selected frame
  selectedFrameId: string | null;
  
  // UI state
  isCapturing: boolean;
  isExporting: boolean;
  viewMode: 'grid' | 'timeline' | 'single';
  
  // Settings
  settings: StoryboardSettings;
  
  // Actions
  createStoryboard: (name: string, aspectRatio?: Storyboard['aspectRatio']) => Storyboard;
  loadStoryboard: (id: string) => void;
  deleteStoryboard: (id: string) => void;
  updateStoryboard: (id: string, updates: Partial<Storyboard>) => void;
  
  // Frame actions
  addFrame: (frame: Omit<StoryboardFrame, 'id' | 'index' | 'createdAt' | 'updatedAt'>) => StoryboardFrame;
  updateFrame: (frameId: string, updates: Partial<StoryboardFrame>) => void;
  deleteFrame: (frameId: string) => void;
  duplicateFrame: (frameId: string) => StoryboardFrame | null;
  reorderFrames: (storyboardId: string, frameId: string, newIndex: number) => void;
  reorderFramesByIndex: (fromIndex: number, toIndex: number) => void;
  selectFrame: (frameId: string | null) => void;
  
  // Annotation actions
  addAnnotation: (frameId: string, annotation: Omit<FrameAnnotationData, 'id' | 'createdAt'>) => FrameAnnotationData;
  updateAnnotation: (frameId: string, annotationId: string, updates: Partial<FrameAnnotationData>) => void;
  deleteAnnotation: (frameId: string, annotationId: string) => void;
  
  // Capture actions
  setCapturing: (isCapturing: boolean) => void;
  
  // Settings
  updateSettings: (settings: Partial<StoryboardSettings>) => void;
  
  // View
  setViewMode: (mode: 'grid' | 'timeline' | 'single') => void;
}

// =============================================================================
// Default Values
// =============================================================================

const defaultSettings: StoryboardSettings = {
  defaultDuration: 5,
  defaultShotType: 'MS',
  showTimecodes: true,
  showTechnicalInfo: true,
  gridColumns: 3,
  autoSave: true,
};

// =============================================================================
// Store
// =============================================================================

export const useStoryboardStore = create<StoryboardState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStoryboard: null,
      storyboards: [],
      selectedFrameId: null,
      isCapturing: false,
      isExporting: false,
      viewMode: 'grid',
      settings: defaultSettings,
      
      // Storyboard CRUD
      createStoryboard: (name, aspectRatio = '16:9') => {
        const storyboard: Storyboard = {
          id: crypto.randomUUID(),
          name,
          aspectRatio,
          frames: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        set((state) => ({
          storyboards: [...state.storyboards, storyboard],
          currentStoryboard: storyboard,
        }));
        
        return storyboard;
      },
      
      loadStoryboard: (id) => {
        const storyboard = get().storyboards.find((s) => s.id === id);
        if (storyboard) {
          set({ currentStoryboard: storyboard, selectedFrameId: null });
        }
      },
      
      deleteStoryboard: (id) => {
        set((state) => ({
          storyboards: state.storyboards.filter((s) => s.id !== id),
          currentStoryboard: state.currentStoryboard?.id === id ? null : state.currentStoryboard,
        }));
      },
      
      updateStoryboard: (id, updates) => {
        set((state) => ({
          storyboards: state.storyboards.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
          ),
          currentStoryboard:
            state.currentStoryboard?.id === id
              ? { ...state.currentStoryboard, ...updates, updatedAt: new Date().toISOString() }
              : state.currentStoryboard,
        }));
      },
      
      // Frame CRUD
      addFrame: (frameData) => {
        const currentStoryboard = get().currentStoryboard;
        if (!currentStoryboard) {
          throw new Error('No storyboard selected ');
        }
        
        const now = new Date().toISOString();
        const frame: StoryboardFrame = {
          ...frameData,
          id: crypto.randomUUID(),
          storyboardId: currentStoryboard.id,
          index: currentStoryboard.frames.length,
          createdAt: now,
          updatedAt: now,
        };
        
        const updatedFrames = [...currentStoryboard.frames, frame];
        
        set((state) => ({
          storyboards: state.storyboards.map((s) =>
            s.id === currentStoryboard.id
              ? { ...s, frames: updatedFrames, updatedAt: now }
              : s
          ),
          currentStoryboard: {
            ...currentStoryboard,
            frames: updatedFrames,
            updatedAt: now,
          },
          selectedFrameId: frame.id,
        }));
        
        return frame;
      },
      
      updateFrame: (frameId, updates) => {
        const currentStoryboard = get().currentStoryboard;
        if (!currentStoryboard) return;
        
        const now = new Date().toISOString();
        const updatedFrames = currentStoryboard.frames.map((f) =>
          f.id === frameId ? { ...f, ...updates, updatedAt: now } : f
        );
        
        set((state) => ({
          storyboards: state.storyboards.map((s) =>
            s.id === currentStoryboard.id
              ? { ...s, frames: updatedFrames, updatedAt: now }
              : s
          ),
          currentStoryboard: {
            ...currentStoryboard,
            frames: updatedFrames,
            updatedAt: now,
          },
        }));
      },
      
      deleteFrame: (frameId) => {
        const currentStoryboard = get().currentStoryboard;
        if (!currentStoryboard) return;
        
        const now = new Date().toISOString();
        const updatedFrames = currentStoryboard.frames
          .filter((f) => f.id !== frameId)
          .map((f, index) => ({ ...f, index })); // Re-index
        
        set((state) => ({
          storyboards: state.storyboards.map((s) =>
            s.id === currentStoryboard.id
              ? { ...s, frames: updatedFrames, updatedAt: now }
              : s
          ),
          currentStoryboard: {
            ...currentStoryboard,
            frames: updatedFrames,
            updatedAt: now,
          },
          selectedFrameId: state.selectedFrameId === frameId ? null : state.selectedFrameId,
        }));
      },

      duplicateFrame: (frameId) => {
        const currentStoryboard = get().currentStoryboard;
        if (!currentStoryboard) return null;
        
        const frameToDuplicate = currentStoryboard.frames.find((f) => f.id === frameId);
        if (!frameToDuplicate) return null;
        
        const now = new Date().toISOString();
        const newFrame: StoryboardFrame = {
          ...frameToDuplicate,
          id: crypto.randomUUID(),
          storyboardId: currentStoryboard.id,
          title: `${frameToDuplicate.title} (Copy)`,
          index: frameToDuplicate.index + 1,
          createdAt: now,
          updatedAt: now,
        };
        
        // Insert after the original and re-index
        const frames = [...currentStoryboard.frames];
        frames.splice(frameToDuplicate.index + 1, 0, newFrame);
        const updatedFrames = frames.map((f, index) => ({ ...f, index }));
        
        set((state) => ({
          storyboards: state.storyboards.map((s) =>
            s.id === currentStoryboard.id
              ? { ...s, frames: updatedFrames, updatedAt: now }
              : s
          ),
          currentStoryboard: {
            ...currentStoryboard,
            frames: updatedFrames,
            updatedAt: now,
          },
          selectedFrameId: newFrame.id,
        }));
        
        return newFrame;
      },
      
      reorderFrames: (storyboardId, frameId, newIndex) => {
        const storyboard = get().storyboards.find((s) => s.id === storyboardId);
        if (!storyboard) return;
        
        const frameIndex = storyboard.frames.findIndex((f) => f.id === frameId);
        if (frameIndex === -1) return;
        
        const frames = [...storyboard.frames];
        const [removed] = frames.splice(frameIndex, 1);
        frames.splice(newIndex, 0, removed);
        
        const updatedFrames = frames.map((f, index) => ({ ...f, index }));
        const now = new Date().toISOString();
        
        set((state) => ({
          storyboards: state.storyboards.map((s) =>
            s.id === storyboardId
              ? { ...s, frames: updatedFrames, updatedAt: now }
              : s
          ),
          currentStoryboard:
            state.currentStoryboard?.id === storyboardId
              ? { ...state.currentStoryboard, frames: updatedFrames, updatedAt: now }
              : state.currentStoryboard,
        }));
      },
      
      reorderFramesByIndex: (fromIndex, toIndex) => {
        const currentStoryboard = get().currentStoryboard;
        if (!currentStoryboard) return;
        
        const frames = [...currentStoryboard.frames];
        const [removed] = frames.splice(fromIndex, 1);
        frames.splice(toIndex, 0, removed);
        
        // Re-index
        const updatedFrames = frames.map((f, index) => ({ ...f, index }));
        const now = new Date().toISOString();
        
        set((state) => ({
          storyboards: state.storyboards.map((s) =>
            s.id === currentStoryboard.id
              ? { ...s, frames: updatedFrames, updatedAt: now }
              : s
          ),
          currentStoryboard: {
            ...currentStoryboard,
            frames: updatedFrames,
            updatedAt: now,
          },
        }));
      },
      
      selectFrame: (frameId) => {
        set({ selectedFrameId: frameId });
      },
      
      // Annotation actions
      addAnnotation: (frameId, annotationData) => {
        const currentStoryboard = get().currentStoryboard;
        if (!currentStoryboard) {
          throw new Error('No storyboard selected');
        }
        
        const frame = currentStoryboard.frames.find((f) => f.id === frameId);
        if (!frame) {
          throw new Error('Frame not found');
        }
        
        const now = new Date().toISOString();
        const annotation: FrameAnnotationData = {
          ...annotationData,
          id: crypto.randomUUID(),
          createdAt: now,
        };
        
        const updatedAnnotations = [...(frame.annotations || []), annotation];
        const updatedFrames = currentStoryboard.frames.map((f) =>
          f.id === frameId ? { ...f, annotations: updatedAnnotations, updatedAt: now } : f
        );
        
        set((state) => ({
          storyboards: state.storyboards.map((s) =>
            s.id === currentStoryboard.id
              ? { ...s, frames: updatedFrames, updatedAt: now }
              : s
          ),
          currentStoryboard: {
            ...currentStoryboard,
            frames: updatedFrames,
            updatedAt: now,
          },
        }));
        
        return annotation;
      },
      
      updateAnnotation: (frameId, annotationId, updates) => {
        const currentStoryboard = get().currentStoryboard;
        if (!currentStoryboard) return;
        
        const frame = currentStoryboard.frames.find((f) => f.id === frameId);
        if (!frame || !frame.annotations) return;
        
        const now = new Date().toISOString();
        const updatedAnnotations = frame.annotations.map((a) =>
          a.id === annotationId ? { ...a, ...updates } : a
        );
        
        const updatedFrames = currentStoryboard.frames.map((f) =>
          f.id === frameId ? { ...f, annotations: updatedAnnotations, updatedAt: now } : f
        );
        
        set((state) => ({
          storyboards: state.storyboards.map((s) =>
            s.id === currentStoryboard.id
              ? { ...s, frames: updatedFrames, updatedAt: now }
              : s
          ),
          currentStoryboard: {
            ...currentStoryboard,
            frames: updatedFrames,
            updatedAt: now,
          },
        }));
      },
      
      deleteAnnotation: (frameId, annotationId) => {
        const currentStoryboard = get().currentStoryboard;
        if (!currentStoryboard) return;
        
        const frame = currentStoryboard.frames.find((f) => f.id === frameId);
        if (!frame || !frame.annotations) return;
        
        const now = new Date().toISOString();
        const updatedAnnotations = frame.annotations.filter((a) => a.id !== annotationId);
        
        const updatedFrames = currentStoryboard.frames.map((f) =>
          f.id === frameId ? { ...f, annotations: updatedAnnotations, updatedAt: now } : f
        );
        
        set((state) => ({
          storyboards: state.storyboards.map((s) =>
            s.id === currentStoryboard.id
              ? { ...s, frames: updatedFrames, updatedAt: now }
              : s
          ),
          currentStoryboard: {
            ...currentStoryboard,
            frames: updatedFrames,
            updatedAt: now,
          },
        }));
      },
      
      // Capture
      setCapturing: (isCapturing) => {
        set({ isCapturing });
      },
      
      // Settings
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },
      
      // View
      setViewMode: (viewMode) => {
        set({ viewMode });
      },
    }),
    {
      name: 'virtual-studio-storyboard',
      partialize: (state) => ({
        storyboards: state.storyboards,
        settings: state.settings,
      }),
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const useCurrentStoryboard = () => useStoryboardStore((s) => s.currentStoryboard);
export const useStoryboards = () => useStoryboardStore((s) => s.storyboards);
export const useSelectedFrame = () => {
  const currentStoryboard = useStoryboardStore((s) => s.currentStoryboard);
  const selectedFrameId = useStoryboardStore((s) => s.selectedFrameId);
  return currentStoryboard?.frames.find((f) => f.id === selectedFrameId) || null;
};
export const useStoryboardSettings = () => useStoryboardStore((s) => s.settings);
export const useIsCapturing = () => useStoryboardStore((s) => s.isCapturing);
export const useViewMode = () => useStoryboardStore((s) => s.viewMode);

// =============================================================================
// Helper Functions
// =============================================================================

export const getShotTypeLabel = (type: ShotType): string => {
  const labels: Record<ShotType, string> = {
    ECU: 'Extreme Close-Up',
    BCU: 'Big Close-Up',
    CU: 'Close-Up',
    MCU: 'Medium Close-Up',
    MS: 'Medium Shot',
    MLS: 'Medium Long Shot',
    LS: 'Long Shot',
    VLS: 'Very Long Shot',
    ELS: 'Extreme Long Shot',
    OTS: 'Over-the-Shoulder',
    POV: 'Point of View',
    Insert: 'Insert',
    Cutaway: 'Cutaway','Two-Shot':'Two-Shot', 'Three-Shot' : 'Three-Shot',
    Group: 'Group Shot',
    Establishing: 'Establishing',
    Master: 'Master Shot',
    Coverage: 'Coverage',
    Reaction: 'Reaction',
    Aerial: 'Aerial',
    Macro: 'Macro',
  };
  return labels[type] || type;
};

export const getShotTypeColor = (type: ShotType): string => {
  const colors: Record<string, string> = {
    ECU: '#ff6b6b',
    BCU: '#ff8787',
    CU: '#ffa94d',
    MCU: '#ffd43b',
    MS: '#69db7c',
    MLS: '#38d9a9',
    LS: '#4dabf7',
    VLS: '#748ffc',
    ELS: '#9775fa',
    OTS: '#da77f2',
    POV: '#f783ac',
  };
  return colors[type] ||'#868e96';
};

export const calculateTotalDuration = (frames: StoryboardFrame[]): number => {
  return frames.reduce((total, frame) => total + frame.duration, 0);
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};
