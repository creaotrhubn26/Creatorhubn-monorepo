/**
 * Animation Store - Timeline and Keyframe System
 *
 * Features: * - Keyframe storage for all animatable properties
 * - Timeline playback control
 * - Interpolation (linear, ease-in, ease-out, bezier)
 * - Camera path recording
 * - Light animation
 */

import { create } from 'zustand';
import type { Scene } from '../core/models/scene';

export type EasingFunction = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bezier';
export type AnimatableValue =
  | number
  | number[]
  | { [key: string]: AnimatableValue };

export interface Keyframe {
  id: string;
  time: number; // Frame number or time in seconds,
  nodeId: string;
  property: string; // e.g.'transform.position.x', 'light.power','camera.focalLength',

  value: AnimatableValue;
  easing: EasingFunction;
  // For bezier curves
  bezierControlPoints?: [number, number, number, number];
}

export interface AnimationTrack {
  id: string;
  nodeId: string;
  nodeName: string;
  property: string;
  keyframes: Keyframe[];
  color: string; // For UI visualization,
  enabled: boolean;
}

export interface TimelineState {
  // Playback
  currentTime: number; // Current frame/time,
  duration: number; // Total duration in frames/seconds,
  fps: number; // Frames per second
  isPlaying: boolean;
  loop: boolean;

  // Tracks and keyframes
  tracks: AnimationTrack[];
  selectedKeyframes: string[]; // Selected keyframe IDs

  // UI state
  zoom: number; // Timeline zoom level
  scrollPosition: number;
  snapToFrames: boolean;

  // Recording
  isRecording: boolean;
  recordingNodeId: string | null;
}

interface AnimationActions {
  // Playback
  play: () => void;
  pause: () => void;
  stop: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setFPS: (fps: number) => void;
  toggleLoop: () => void;

  // Keyframes
  addKeyframe: (keyframe: Omit<Keyframe, 'id'>) => void;
  removeKeyframe: (id: string) => void;
  updateKeyframe: (id: string, updates: Partial<Keyframe>) => void;
  moveKeyframe: (id: string, newTime: number) => void;
  selectKeyframe: (id: string, addToSelection?: boolean) => void;
  clearSelection: () => void;

  // Tracks
  addTrack: (track: Omit<AnimationTrack, 'id'>) => void;
  removeTrack: (id: string) => void;
  toggleTrack: (id: string) => void;

  // Recording
  startRecording: (nodeId: string) => void;
  stopRecording: () => void;

  // UI
  setZoom: (zoom: number) => void;
  setScrollPosition: (position: number) => void;
  toggleSnapToFrames: () => void;

  // Animation
  getValueAtTime: (nodeId: string, property: string, time: number) => AnimatableValue | null;
  applyAnimationAtTime: (time: number, scene: Scene) => Scene;
}

type AnimationStore = TimelineState & AnimationActions;

/**
 * Interpolate between two values
 */
function interpolate(
  startValue: AnimatableValue,
  endValue: AnimatableValue,
  progress: number,
  easing: EasingFunction,
  controlPoints?: [number, number, number, number],
): AnimatableValue {
  // Apply easing function
  let easedProgress = progress;

  switch (easing) {
    case 'linear':
      easedProgress = progress;
      break;
    case 'easeIn':
      easedProgress = progress * progress;
      break;
    case 'easeOut':
      easedProgress = 1 - (1 - progress) * (1 - progress);
      break;
    case 'easeInOut':
      easedProgress =
        progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      break;
    case 'bezier':
      if (controlPoints) {
        // Cubic bezier implementation
        const t = progress;
        easedProgress =
          Math.pow(1 - t, 3) * controlPoints[0] +
          3 * Math.pow(1 - t, 2) * t * controlPoints[1] +
          3 * (1 - t) * Math.pow(t, 2) * controlPoints[2] +
          Math.pow(t, 3) * controlPoints[3];
      }
      break;
  }

  // Interpolate based on value type
  if (typeof startValue === 'number' && typeof endValue === 'number') {
    return startValue + (endValue - startValue) * easedProgress;
  }

  // Array interpolation (for position, rotation, etc.)
  if (Array.isArray(startValue) && Array.isArray(endValue)) {
    return startValue.map((start, i) => start + (endValue[i] - start) * easedProgress);
  }

  // Object interpolation (for nested properties)
  if (
    typeof startValue === 'object' &&
    startValue !== null &&
    !Array.isArray(startValue) &&
    typeof endValue === 'object' &&
    endValue !== null &&
    !Array.isArray(endValue)
  ) {
    const result: { [key: string]: AnimatableValue } = {};
    const startEntries = Object.entries(startValue);

    for (const [key, startChild] of startEntries) {
      const endChild = endValue[key];
      if (endChild === undefined) {
        result[key] = startChild;
        continue;
      }

      result[key] = interpolate(
        startChild,
        endChild,
        easedProgress,
        easing,
        controlPoints,
      );
    }
    return result;
  }

  // Default: return end value
  return endValue;
}

/**
 * Get value from nested property path
 */
function getNestedValue(obj: object, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (typeof current === 'object' && current !== null) {
      return Reflect.get(current, key);
    }

    return undefined;
  }, obj);
}

/**
 * Set value at nested property path
 */
function setNestedValue<T extends object>(obj: T, path: string, value: AnimatableValue): T {
  const keys = path.split('.');
  const lastKey = keys.pop()!;

  const target = keys.reduce<object>((current, key) => {
    const next = Reflect.get(current, key);
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      Reflect.set(current, key, {});
    }

    return Reflect.get(current, key) as object;
  }, obj);

  Reflect.set(target, lastKey, value);
  return obj;
}

export const useAnimationStore = create<AnimationStore>((set, get) => ({
  // Initial state
  currentTime: 0,
  duration: 300, // 10 seconds at 30fps
  fps: 30,
  isPlaying: false,
  loop: false,

  tracks: [],
  selectedKeyframes: [],

  zoom: 1,
  scrollPosition: 0,
  snapToFrames: true,

  isRecording: false,
  recordingNodeId: null,

  // Playback actions
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  stop: () => set({ isPlaying: false, currentTime: 0 }),

  setCurrentTime: (time) => {
    const { duration, loop } = get();
    let newTime = time;

    if (newTime > duration) {
      newTime = loop ? 0 : duration;
      if (!loop) set({ isPlaying: false });
    }
    if (newTime < 0) newTime = 0;

    set({ currentTime: newTime });
  },

  setDuration: (duration) => set({ duration }),
  setFPS: (fps) => set({ fps }),
  toggleLoop: () => set((state) => ({ loop: !state.loop })),

  // Keyframe actions
  addKeyframe: (keyframe) => {
    const id = `kf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newKeyframe: Keyframe = { ...keyframe, id };

    set((state) => {
      const tracks = [...state.tracks];
      let track = tracks.find(
        (t) => t.nodeId === keyframe.nodeId && t.property === keyframe.property,
      );

      if (!track) {
        // Create new track
        track = {
          id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          nodeId: keyframe.nodeId,
          nodeName: keyframe.nodeId, // Should get from scene
          property: keyframe.property,
          keyframes: [],
          color: `hsl(${Math.random() * 360}, 70%, 50%)`,
          enabled: true,
        };
        tracks.push(track);
      }

      // Add keyframe in sorted order
      track.keyframes.push(newKeyframe);
      track.keyframes.sort((a, b) => a.time - b.time);

      return { tracks };
    });
  },

  removeKeyframe: (id) => {
    set((state) => ({
      tracks: state.tracks
        .map((track) => ({
          ...track,
          keyframes: track.keyframes.filter((kf) => kf.id !== id),
        }))
        .filter((track) => track.keyframes.length > 0),
      selectedKeyframes: state.selectedKeyframes.filter((kfId) => kfId !== id),
    }));
  },

  updateKeyframe: (id, updates) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((kf) => (kf.id === id ? { ...kf, ...updates } : kf)),
      })),
    }));
  },

  moveKeyframe: (id, newTime) => {
    set((state) => ({
      tracks: state.tracks.map((track) => {
        const keyframes = track.keyframes.map((kf) =>
          kf.id === id ? { ...kf, time: newTime } : kf,
        );
        keyframes.sort((a, b) => a.time - b.time);
        return { ...track, keyframes };
      }),
    }));
  },

  selectKeyframe: (id, addToSelection = false) => {
    set((state) => ({
      selectedKeyframes: addToSelection ? [...state.selectedKeyframes, id] : [id],
    }));
  },

  clearSelection: () => set({ selectedKeyframes: [] }),

  // Track actions
  addTrack: (track) => {
    const id = `track_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    set((state) => ({
      tracks: [...state.tracks, { ...track, id }],
    }));
  },

  removeTrack: (id) => {
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== id),
    }));
  },

  toggleTrack: (id) => {
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
    }));
  },

  // Recording actions
  startRecording: (nodeId) => {
    set({ isRecording: true, recordingNodeId: nodeId });
  },

  stopRecording: () => {
    set({ isRecording: false, recordingNodeId: null });
  },

  // UI actions
  setZoom: (zoom) => set({ zoom }),
  setScrollPosition: (position) => set({ scrollPosition: position }),
  toggleSnapToFrames: () => set((state) => ({ snapToFrames: !state.snapToFrames })),

  // Animation evaluation
  getValueAtTime: (nodeId, property, time) => {
    const { tracks } = get();
    const track = tracks.find((t) => t.nodeId === nodeId && t.property === property && t.enabled);

    if (!track || track.keyframes.length === 0) return null;

    // Find surrounding keyframes
    const keyframes = track.keyframes;

    // Before first keyframe
    if (time <= keyframes[0].time) {
      return keyframes[0].value;
    }

    // After last keyframe
    if (time >= keyframes[keyframes.length - 1].time) {
      return keyframes[keyframes.length - 1].value;
    }

    // Find keyframes to interpolate between
    for (let i = 0; i < keyframes.length - 1; i++) {
      const kf1 = keyframes[i];
      const kf2 = keyframes[i + 1];

      if (time >= kf1.time && time <= kf2.time) {
        const duration = kf2.time - kf1.time;
        const progress = (time - kf1.time) / duration;

        return interpolate(kf1.value, kf2.value, progress, kf1.easing, kf1.bezierControlPoints);
      }
    }

    return null;
  },

  applyAnimationAtTime: (time, scene) => {
    const { tracks } = get();
    const newScene = JSON.parse(JSON.stringify(scene)) as Scene;

    for (const track of tracks) {
      if (!track.enabled) continue;

      const value = get().getValueAtTime(track.nodeId, track.property, time);
      if (value === null) continue;

      // Find node in scene
      const node = newScene.nodes.find((sceneNode) => sceneNode.id === track.nodeId);
      if (!node) continue;

      const currentValue = getNestedValue(node, track.property);
      if (JSON.stringify(currentValue) === JSON.stringify(value)) {
        continue;
      }

      // Apply value to node
      setNestedValue(node, track.property, value);
    }

    return newScene;
  },
}));
