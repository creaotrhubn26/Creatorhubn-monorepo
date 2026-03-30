/**
 * Storyboard Store
 * 
 * Zustand store for managing storyboards and frames
 */

import { create } from 'zustand';
import type { ShotType, CameraAngle, CameraMovement } from '../models/casting';
import type { StoryboardDrawingDocument } from './storyboardDrawingDocument';
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

export interface FrameDrawingData {
  dataUrl: string; // Base64 canvas export
  strokes?: string; // JSON stringified stroke data for replay
  document?: StoryboardDrawingDocument; // Versioned drawing document for layers/timeline/spatial state
  baseImageUrl?: string; // Underlay/reference image used while drawing
  originalBaseImageUrl?: string; // Original frame/base image to restore after draw-over edits
  brushSettings?: {
    type: string;
    size: number;
    color: string;
    opacity: number;
  };
  deviceType?: 'pencil' | 'touch' | 'mouse';
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
  createStoryboard: (name: string, aspectRatio: Storyboard['aspectRatio']) => Storyboard;
  updateStoryboard: (storyboardId: string, updates: Partial<Storyboard>) => void;
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
    return newStoryboard;
  },

  updateStoryboard: (storyboardId, updates) => {
    set((state) => ({
      storyboards: state.storyboards.map((storyboard) =>
        storyboard.id === storyboardId
          ? {
              ...storyboard,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : storyboard,
      ),
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
