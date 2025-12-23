/**
 * useSceneAnimation - React hook for scene animation control
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import {
  sceneAnimationService,
  AnimationState,
  AnimationClipConfig,
  AnimationTrackConfig,
  Keyframe,
  ANIMATION_PRESETS,
  EasingType,
} from'../core/services/sceneAnimationService';

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UseSceneAnimationReturn {
  // State
  states: Map<string, AnimationState>;
  isAnyPlaying: boolean;
  globalSpeed: number;

  // Registration
  registerObject: (id: string, object: THREE.Object3D) => void;
  unregisterObject: (id: string) => void;

  // Animation Creation
  addAnimation: (objectId: string, config: AnimationClipConfig) => THREE.AnimationAction | null;
  removeAnimation: (objectId: string, clipId: string) => void;
  applyPreset: (objectId: string, preset: keyof typeof ANIMATION_PRESETS, ...args: any[]) => THREE.AnimationAction | null;

  // Playback Control
  play: (objectId: string, clipId?: string) => void;
  pause: (objectId: string) => void;
  resume: (objectId: string) => void;
  stop: (objectId: string) => void;
  setTime: (objectId: string, time: number) => void;
  setSpeed: (objectId: string, speed: number) => void;
  setLoop: (objectId: string, loop: boolean) => void;

  // Global Control
  playAll: () => void;
  pauseAll: () => void;
  stopAll: () => void;
  setGlobalSpeed: (speed: number) => void;
  setGlobalTime: (time: number) => void;

  // Crossfade
  crossfade: (objectId: string, fromClipId: string, toClipId: string, duration?: number) => void;

  // Utilities
  createKeyframes: (property: AnimationTrackConfig['property'], points: Array<{ time: number; value: any; easing?: EasingType }>) => Keyframe[];
  createClipConfig: (name: string, tracks: AnimationTrackConfig[]) => AnimationClipConfig;

  // Update (for external render loops)
  update: (delta: number) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSceneAnimation(): UseSceneAnimationReturn {
  const [states, setStates] = useState<Map<string, AnimationState>>(new Map());
  const [globalSpeed, setGlobalSpeedState] = useState(1);

  // Subscribe to state changes
  useEffect(() => {
    return sceneAnimationService.subscribe(setStates);
  }, []);

  // Registration
  const registerObject = useCallback((id: string, object: THREE.Object3D) => {
    sceneAnimationService.registerObject(id, object);
  }, []);

  const unregisterObject = useCallback((id: string) => {
    sceneAnimationService.unregisterObject(id);
  }, []);

  // Animation Creation
  const addAnimation = useCallback((objectId: string, config: AnimationClipConfig) => {
    return sceneAnimationService.addAnimation(objectId, config);
  }, []);

  const removeAnimation = useCallback((objectId: string, clipId: string) => {
    sceneAnimationService.removeAnimation(objectId, clipId);
  }, []);

  const applyPreset = useCallback((
    objectId: string,
    preset: keyof typeof ANIMATION_PRESETS,
    ...args: any[]
  ) => {
    return sceneAnimationService.applyPreset(objectId, preset, ...args);
  }, []);

  // Playback Control
  const play = useCallback((objectId: string, clipId?: string) => {
    sceneAnimationService.play(objectId, clipId);
  }, []);

  const pause = useCallback((objectId: string) => {
    sceneAnimationService.pause(objectId);
  }, []);

  const resume = useCallback((objectId: string) => {
    sceneAnimationService.resume(objectId);
  }, []);

  const stop = useCallback((objectId: string) => {
    sceneAnimationService.stop(objectId);
  }, []);

  const setTime = useCallback((objectId: string, time: number) => {
    sceneAnimationService.setTime(objectId, time);
  }, []);

  const setSpeed = useCallback((objectId: string, speed: number) => {
    sceneAnimationService.setSpeed(objectId, speed);
  }, []);

  const setLoop = useCallback((objectId: string, loop: boolean) => {
    sceneAnimationService.setLoop(objectId, loop);
  }, []);

  // Global Control
  const playAll = useCallback(() => {
    sceneAnimationService.playAll();
  }, []);

  const pauseAll = useCallback(() => {
    sceneAnimationService.pauseAll();
  }, []);

  const stopAll = useCallback(() => {
    sceneAnimationService.stopAll();
  }, []);

  const setGlobalSpeed = useCallback((speed: number) => {
    sceneAnimationService.setGlobalSpeed(speed);
    setGlobalSpeedState(speed);
  }, []);

  const setGlobalTime = useCallback((time: number) => {
    sceneAnimationService.setGlobalTime(time);
  }, []);

  // Crossfade
  const crossfade = useCallback((
    objectId: string,
    fromClipId: string,
    toClipId: string,
    duration?: number
  ) => {
    sceneAnimationService.crossfade(objectId, fromClipId, toClipId, duration);
  }, []);

  // Utilities
  const createKeyframes = useCallback((
    property: AnimationTrackConfig['property'],
    points: Array<{ time: number; value: any; easing?: EasingType }>
  ): Keyframe[] => {
    return points.map((p) => ({
      time: p.time,
      value: p.value,
      easing: p.easing,
    }));
  }, []);

  const createClipConfig = useCallback((
    name: string,
    tracks: AnimationTrackConfig[]
  ): AnimationClipConfig => {
    const maxDuration = Math.max(
      ...tracks.flatMap((t) => t.keyframes.map((kf) => kf.time))
    );
    return {
      id: `clip_${name}_${Date.now()}`,
      name,
      duration: maxDuration,
      tracks,
    };
  }, []);

  const update = useCallback((delta: number) => {
    sceneAnimationService.update(delta);
  }, []);

  const isAnyPlaying = useMemo(() => {
    for (const [, state] of states) {
      if (state.isPlaying && !state.isPaused) return true;
    }
    return false;
  }, [states]);

  return {
    states,
    isAnyPlaying,
    globalSpeed,
    registerObject,
    unregisterObject,
    addAnimation,
    removeAnimation,
    applyPreset,
    play,
    pause,
    resume,
    stop,
    setTime,
    setSpeed,
    setLoop,
    playAll,
    pauseAll,
    stopAll,
    setGlobalSpeed,
    setGlobalTime,
    crossfade,
    createKeyframes,
    createClipConfig,
    update,
  };
}

export default useSceneAnimation;

