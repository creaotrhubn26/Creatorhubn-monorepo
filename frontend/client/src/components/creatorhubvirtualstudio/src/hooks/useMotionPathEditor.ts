/**
 * useMotionPathEditor - Hook to wire MotionPathEditor3D into R3F canvas
 * 
 * Features:
 * - Track selection and management
 * - Keyframe CRUD operations
 * - Grid snapping configuration
 * - Editor visibility toggle
 * - Integration with animation state
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { AnimationTrack, Keyframe } from '../core/animation/SceneGraphAnimationEngine';

// ============================================================================
// Types
// ============================================================================

export interface MotionPathEditorState {
  // Visibility
  isVisible: boolean;
  showPath: boolean;
  showKeyframes: boolean;
  showLabels: boolean;
  showCurrentPosition: boolean;
  showGroundProjection: boolean;

  // Interaction
  selectedTrackId: string | null;
  selectedKeyframeIndex: number | null;
  hoveredKeyframeIndex: number | null;
  isDragging: boolean;

  // Configuration
  gridSnap: number;
  pathColor: string;
  keyframeColor: string;
  selectedColor: string;
  pathSegments: number;
}

export interface UseMotionPathEditorOptions {
  defaultGridSnap?: number;
  defaultPathColor?: string;
  defaultKeyframeColor?: string;
  defaultSelectedColor?: string;
  autoSelectFirstTrack?: boolean;
}

export interface UseMotionPathEditorReturn {
  // State
  state: MotionPathEditorState;
  selectedTrack: AnimationTrack | null;
  positionTracks: AnimationTrack[];

  // Visibility controls
  toggleVisibility: () => void;
  setShowPath: (show: boolean) => void;
  setShowKeyframes: (show: boolean) => void;
  setShowLabels: (show: boolean) => void;
  setShowCurrentPosition: (show: boolean) => void;
  setShowGroundProjection: (show: boolean) => void;

  // Track selection
  selectTrack: (trackId: string | null) => void;
  selectNextTrack: () => void;
  selectPrevTrack: () => void;

  // Keyframe selection
  selectKeyframe: (index: number | null) => void;
  selectNextKeyframe: () => void;
  selectPrevKeyframe: () => void;
  hoverKeyframe: (index: number | null) => void;

  // Keyframe operations
  updateKeyframePosition: (index: number, position: THREE.Vector3) => void;
  addKeyframe: (time: number, position: THREE.Vector3) => void;
  deleteKeyframe: (index: number) => void;
  duplicateKeyframe: (index: number) => void;

  // Configuration
  setGridSnap: (snap: number) => void;
  setPathColor: (color: string) => void;
  setKeyframeColor: (color: string) => void;
  setSelectedColor: (color: string) => void;

  // Drag state
  setIsDragging: (dragging: boolean) => void;

  // Props generator for MotionPathEditor3D
  getEditorProps: () => MotionPathEditor3DProps;
}

export interface MotionPathEditor3DProps {
  track: AnimationTrack;
  currentTime: number;
  selectedKeyframeIndex: number | null;
  gridSnap: number;
  onSelectKeyframe: (index: number | null) => void;
  onUpdateKeyframe: (index: number, position: THREE.Vector3) => void;
  onAddKeyframe: (time: number, position: THREE.Vector3) => void;
  onDeleteKeyframe: (index: number) => void;
  showPath: boolean;
  showKeyframes: boolean;
  showLabels: boolean;
  pathColor: string;
  keyframeColor: string;
  selectedColor: string;
}

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_STATE: MotionPathEditorState = {
  isVisible: true,
  showPath: true,
  showKeyframes: true,
  showLabels: true,
  showCurrentPosition: true,
  showGroundProjection: true,
  selectedTrackId: null,
  selectedKeyframeIndex: null,
  hoveredKeyframeIndex: null,
  isDragging: false,
  gridSnap: 0.5,
  pathColor: '#4fc3f7',
  keyframeColor: '#ff9800',
  selectedColor: '#f44336',
  pathSegments: 64,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMotionPathEditor(
  tracks: AnimationTrack[],
  currentTime: number,
  options: UseMotionPathEditorOptions = {},
  onUpdateTrack?: (track: AnimationTrack) => void
): UseMotionPathEditorReturn {
  const {
    defaultGridSnap = 0.5,
    defaultPathColor = '#4fc3f7',
    defaultKeyframeColor = '#ff9800',
    defaultSelectedColor = '#f44336',
    autoSelectFirstTrack = true,
  } = options;

  // State
  const [state, setState] = useState<MotionPathEditorState>({
    ...DEFAULT_STATE,
    gridSnap: defaultGridSnap,
    pathColor: defaultPathColor,
    keyframeColor: defaultKeyframeColor,
    selectedColor: defaultSelectedColor,
  });

  // Filter to position tracks only
  const positionTracks = useMemo(() => {
    return tracks.filter((t) => t.type === 'position');
  }, [tracks]);

  // Get selected track
  const selectedTrack = useMemo(() => {
    if (!state.selectedTrackId) return null;
    return positionTracks.find((t) => t.id === state.selectedTrackId) || null;
  }, [state.selectedTrackId, positionTracks]);

  // Auto-select first track
  useEffect(() => {
    if (autoSelectFirstTrack && !state.selectedTrackId && positionTracks.length > 0) {
      setState((prev) => ({ ...prev, selectedTrackId: positionTracks[0].id }));
    }
  }, [autoSelectFirstTrack, state.selectedTrackId, positionTracks]);

  // -------------------------------------------------------------------------
  // Visibility Controls
  // -------------------------------------------------------------------------

  const toggleVisibility = useCallback(() => {
    setState((prev) => ({ ...prev, isVisible: !prev.isVisible }));
  }, []);

  const setShowPath = useCallback((show: boolean) => {
    setState((prev) => ({ ...prev, showPath: show }));
  }, []);

  const setShowKeyframes = useCallback((show: boolean) => {
    setState((prev) => ({ ...prev, showKeyframes: show }));
  }, []);

  const setShowLabels = useCallback((show: boolean) => {
    setState((prev) => ({ ...prev, showLabels: show }));
  }, []);

  const setShowCurrentPosition = useCallback((show: boolean) => {
    setState((prev) => ({ ...prev, showCurrentPosition: show }));
  }, []);

  const setShowGroundProjection = useCallback((show: boolean) => {
    setState((prev) => ({ ...prev, showGroundProjection: show }));
  }, []);

  // -------------------------------------------------------------------------
  // Track Selection
  // -------------------------------------------------------------------------

  const selectTrack = useCallback((trackId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedTrackId: trackId,
      selectedKeyframeIndex: null,
    }));
  }, []);

  const selectNextTrack = useCallback(() => {
    if (positionTracks.length === 0) return;
    const currentIndex = positionTracks.findIndex((t) => t.id === state.selectedTrackId);
    const nextIndex = (currentIndex + 1) % positionTracks.length;
    selectTrack(positionTracks[nextIndex].id);
  }, [positionTracks, state.selectedTrackId, selectTrack]);

  const selectPrevTrack = useCallback(() => {
    if (positionTracks.length === 0) return;
    const currentIndex = positionTracks.findIndex((t) => t.id === state.selectedTrackId);
    const prevIndex = currentIndex <= 0 ? positionTracks.length - 1 : currentIndex - 1;
    selectTrack(positionTracks[prevIndex].id);
  }, [positionTracks, state.selectedTrackId, selectTrack]);

  // -------------------------------------------------------------------------
  // Keyframe Selection
  // -------------------------------------------------------------------------

  const selectKeyframe = useCallback((index: number | null) => {
    setState((prev) => ({ ...prev, selectedKeyframeIndex: index }));
  }, []);

  const selectNextKeyframe = useCallback(() => {
    if (!selectedTrack || selectedTrack.keyframes.length === 0) return;
    const currentIndex = state.selectedKeyframeIndex ?? -1;
    const nextIndex = (currentIndex + 1) % selectedTrack.keyframes.length;
    selectKeyframe(nextIndex);
  }, [selectedTrack, state.selectedKeyframeIndex, selectKeyframe]);

  const selectPrevKeyframe = useCallback(() => {
    if (!selectedTrack || selectedTrack.keyframes.length === 0) return;
    const currentIndex = state.selectedKeyframeIndex ?? 0;
    const prevIndex = currentIndex <= 0 ? selectedTrack.keyframes.length - 1 : currentIndex - 1;
    selectKeyframe(prevIndex);
  }, [selectedTrack, state.selectedKeyframeIndex, selectKeyframe]);

  const hoverKeyframe = useCallback((index: number | null) => {
    setState((prev) => ({ ...prev, hoveredKeyframeIndex: index }));
  }, []);

  // -------------------------------------------------------------------------
  // Keyframe Operations
  // -------------------------------------------------------------------------

  const updateKeyframePosition = useCallback(
    (index: number, position: THREE.Vector3) => {
      if (!selectedTrack) return;

      // Apply grid snapping
      const snappedPosition = new THREE.Vector3(
        Math.round(position.x / state.gridSnap) * state.gridSnap,
        Math.round(position.y / state.gridSnap) * state.gridSnap,
        Math.round(position.z / state.gridSnap) * state.gridSnap
      );

      const updatedKeyframes = [...selectedTrack.keyframes];
      updatedKeyframes[index] = {
        ...updatedKeyframes[index],
        value: [snappedPosition.x, snappedPosition.y, snappedPosition.z],
      };

      const updatedTrack: AnimationTrack = {
        ...selectedTrack,
        keyframes: updatedKeyframes,
      };

      onUpdateTrack?.(updatedTrack);
    },
    [selectedTrack, state.gridSnap, onUpdateTrack]
  );

  const addKeyframe = useCallback(
    (time: number, position: THREE.Vector3) => {
      if (!selectedTrack) return;

      // Apply grid snapping
      const snappedPosition = new THREE.Vector3(
        Math.round(position.x / state.gridSnap) * state.gridSnap,
        Math.round(position.y / state.gridSnap) * state.gridSnap,
        Math.round(position.z / state.gridSnap) * state.gridSnap
      );

      const newKeyframe: Keyframe = {
        time,
        value: [snappedPosition.x, snappedPosition.y, snappedPosition.z],
        easing: 'easeInOut',
      };

      // Insert in sorted order
      const newKeyframes = [...selectedTrack.keyframes, newKeyframe].sort(
        (a, b) => a.time - b.time
      );

      const updatedTrack: AnimationTrack = {
        ...selectedTrack,
        keyframes: newKeyframes,
      };

      onUpdateTrack?.(updatedTrack);

      // Select the new keyframe
      const newIndex = newKeyframes.findIndex((kf) => kf.time === time);
      selectKeyframe(newIndex);
    },
    [selectedTrack, state.gridSnap, onUpdateTrack, selectKeyframe]
  );

  const deleteKeyframe = useCallback(
    (index: number) => {
      if (!selectedTrack || selectedTrack.keyframes.length <= 2) return;

      const updatedKeyframes = selectedTrack.keyframes.filter((_, i) => i !== index);

      const updatedTrack: AnimationTrack = {
        ...selectedTrack,
        keyframes: updatedKeyframes,
      };

      onUpdateTrack?.(updatedTrack);

      // Adjust selection
      if (state.selectedKeyframeIndex !== null) {
        if (state.selectedKeyframeIndex >= updatedKeyframes.length) {
          selectKeyframe(updatedKeyframes.length - 1);
        } else if (state.selectedKeyframeIndex > index) {
          selectKeyframe(state.selectedKeyframeIndex - 1);
        }
      }
    },
    [selectedTrack, state.selectedKeyframeIndex, onUpdateTrack, selectKeyframe]
  );

  const duplicateKeyframe = useCallback(
    (index: number) => {
      if (!selectedTrack) return;

      const sourceKeyframe = selectedTrack.keyframes[index];
      const nextKeyframe = selectedTrack.keyframes[index + 1];

      // Calculate time offset (halfway to next keyframe or +0.5s)
      const timeOffset = nextKeyframe
        ? (nextKeyframe.time - sourceKeyframe.time) / 2
        : 0.5;

      const newKeyframe: Keyframe = {
        ...sourceKeyframe,
        time: sourceKeyframe.time + timeOffset,
      };

      const newKeyframes = [...selectedTrack.keyframes, newKeyframe].sort(
        (a, b) => a.time - b.time
      );

      const updatedTrack: AnimationTrack = {
        ...selectedTrack,
        keyframes: newKeyframes,
      };

      onUpdateTrack?.(updatedTrack);
    },
    [selectedTrack, onUpdateTrack]
  );

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  const setGridSnap = useCallback((snap: number) => {
    setState((prev) => ({ ...prev, gridSnap: Math.max(0.1, snap) }));
  }, []);

  const setPathColor = useCallback((color: string) => {
    setState((prev) => ({ ...prev, pathColor: color }));
  }, []);

  const setKeyframeColor = useCallback((color: string) => {
    setState((prev) => ({ ...prev, keyframeColor: color }));
  }, []);

  const setSelectedColor = useCallback((color: string) => {
    setState((prev) => ({ ...prev, selectedColor: color }));
  }, []);

  const setIsDragging = useCallback((dragging: boolean) => {
    setState((prev) => ({ ...prev, isDragging: dragging }));
  }, []);

  // -------------------------------------------------------------------------
  // Props Generator
  // -------------------------------------------------------------------------

  const getEditorProps = useCallback((): MotionPathEditor3DProps | null => {
    if (!selectedTrack) return null;

    return {
      track: selectedTrack,
      currentTime,
      selectedKeyframeIndex: state.selectedKeyframeIndex,
      gridSnap: state.gridSnap,
      onSelectKeyframe: selectKeyframe,
      onUpdateKeyframe: updateKeyframePosition,
      onAddKeyframe: addKeyframe,
      onDeleteKeyframe: deleteKeyframe,
      showPath: state.showPath,
      showKeyframes: state.showKeyframes,
      showLabels: state.showLabels,
      pathColor: state.pathColor,
      keyframeColor: state.keyframeColor,
      selectedColor: state.selectedColor,
    };
  }, [
    selectedTrack,
    currentTime,
    state.selectedKeyframeIndex,
    state.gridSnap,
    state.showPath,
    state.showKeyframes,
    state.showLabels,
    state.pathColor,
    state.keyframeColor,
    state.selectedColor,
    selectKeyframe,
    updateKeyframePosition,
    addKeyframe,
    deleteKeyframe,
  ]);

  return {
    // State
    state,
    selectedTrack,
    positionTracks,

    // Visibility controls
    toggleVisibility,
    setShowPath,
    setShowKeyframes,
    setShowLabels,
    setShowCurrentPosition,
    setShowGroundProjection,

    // Track selection
    selectTrack,
    selectNextTrack,
    selectPrevTrack,

    // Keyframe selection
    selectKeyframe,
    selectNextKeyframe,
    selectPrevKeyframe,
    hoverKeyframe,

    // Keyframe operations
    updateKeyframePosition,
    addKeyframe,
    deleteKeyframe,
    duplicateKeyframe,

    // Configuration
    setGridSnap,
    setPathColor,
    setKeyframeColor,
    setSelectedColor,

    // Drag state
    setIsDragging,

    // Props generator
    getEditorProps: getEditorProps as () => MotionPathEditor3DProps,
  };
}

export default useMotionPathEditor;

