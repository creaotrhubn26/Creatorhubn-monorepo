/**
 * SceneAnimationService - Professional Three.js Animation System
 * 
 * Features:
 * - KeyframeTrack creation (position, rotation, scale, properties)
 * - AnimationClip management
 * - AnimationMixer per-object control
 * - AnimationAction playback (play, pause, loop, fade)
 * - Timeline integration
 * - Easing functions
 * - Animation presets
 */

import * as THREE from 'three';
import { logger } from './logger';

const log = logger.module('SceneAnimation, ');

// ============================================================================
// Types
// ============================================================================

export type EasingType = 
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInElastic'
  | 'easeOutElastic'
  | 'easeOutBounce';

export interface Keyframe<T = any> {
  time: number;       // Time in seconds
  value: T;           // Value at this keyframe
  easing?: EasingType; // Easing to next keyframe
}

export interface AnimationTrackConfig {
  id: string;
  targetId: string;   // Scene node ID
  property: 'position' | 'rotation' | 'scale' | 'opacity' | 'color' | 'intensity' | 'fov';
  keyframes: Keyframe[];
  interpolation?: THREE.InterpolationModes;
}

export interface AnimationClipConfig {
  id: string;
  name: string;
  duration: number;
  tracks: AnimationTrackConfig[];
  loop?: THREE.AnimationActionLoopStyles;
  loopCount?: number;
}

export interface AnimationState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  loop: boolean;
}

export interface AnimatedObject {
  id: string;
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  actions: Map<string, THREE.AnimationAction>;
  state: AnimationState;
}

// ============================================================================
// Easing Functions
// ============================================================================

export const EASING_FUNCTIONS: Record<EasingType, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI) / 3),
  easeOutElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// ============================================================================
// Animation Presets
// ============================================================================

export const ANIMATION_PRESETS = {
  fadeIn: (duration = 1): AnimationTrackConfig => ({
    id: 'fadeIn',
    targetId: '',
    property: 'opacity',
    keyframes: [
      { time: 0, value: 0 },
      { time: duration, value: 1, easing: 'easeOut' },
    ],
  }),
  
  fadeOut: (duration = 1): AnimationTrackConfig => ({
    id: 'fadeOut',
    targetId: '',
    property: 'opacity',
    keyframes: [
      { time: 0, value: 1 },
      { time: duration, value: 0, easing: 'easeIn' },
    ],
  }),

  slideInLeft: (duration = 0.5, distance = 5): AnimationTrackConfig => ({
    id: 'slideInLeft',
    targetId: '',
    property: 'position',
    keyframes: [
      { time: 0, value: [-distance, 0, 0] },
      { time: duration, value: [0, 0, 0], easing: 'easeOutCubic' },
    ],
  }),

  slideInRight: (duration = 0.5, distance = 5): AnimationTrackConfig => ({
    id: 'slideInRight',
    targetId: '',
    property: 'position',
    keyframes: [
      { time: 0, value: [distance, 0, 0] },
      { time: duration, value: [0, 0, 0], easing: 'easeOutCubic' },
    ],
  }),

  scaleIn: (duration = 0.3): AnimationTrackConfig => ({
    id: 'scaleIn',
    targetId: '',
    property: 'scale',
    keyframes: [
      { time: 0, value: [0, 0, 0] },
      { time: duration, value: [1, 1, 1], easing: 'easeOutElastic' },
    ],
  }),

  bounce: (duration = 0.5, height = 0.5): AnimationTrackConfig => ({
    id: 'bounce',
    targetId: ', ',
    property: 'position',
    keyframes: [
      { time: 0, value: [0, 0, 0] },
      { time: duration * 0.5, value: [0, height, 0], easing: 'easeOut' },
      { time: duration, value: [0, 0, 0], easing: 'easeOutBounce' },
    ],
  }),

  rotate360: (duration = 2, axis: 'x' | 'y' | 'z' = 'y'): AnimationTrackConfig => ({
    id: 'rotate360',
    targetId: ', ',
    property: 'rotation',
    keyframes: [
      { time: 0, value: [0, 0, 0'XYZ'] },
      { time: duration, value: axis === 'x' ? [Math.PI * 2, 0, 0'XYZ'] : axis === 'y' ? [0, Math.PI * 2, 0'XYZ'] : [0, 0, Math.PI * 2'XYZ'], easing: 'linear' },
    ],
  }),

  pulse: (duration = 1, scale = 1.2): AnimationTrackConfig => ({
    id: 'pulse',
    targetId: ', ',
    property: 'scale',
    keyframes: [
      { time: 0, value: [1, 1, 1] },
      { time: duration * 0.5, value: [scale, scale, scale], easing: 'easeInOut' },
      { time: duration, value: [1, 1, 1], easing: 'easeInOut' },
    ],
  }),

  lightFlicker: (duration = 0.5): AnimationTrackConfig => ({
    id: 'lightFlicker',
    targetId: ', ',
    property: 'intensity',
    keyframes: [
      { time: 0, value: 1 },
      { time: duration * 0.1, value: 0.3 },
      { time: duration * 0.2, value: 1 },
      { time: duration * 0.3, value: 0.5 },
      { time: duration * 0.5, value: 1 },
      { time: duration * 0.7, value: 0.7 },
      { time: duration, value: 1 },
    ],
  }),

  cameraOrbit: (duration = 10, radius = 5, height = 2): AnimationTrackConfig => ({
    id: 'cameraOrbit',
    targetId: ', ',
    property: 'position',
    keyframes: Array.from({ length: 37 }, (_, i) => ({
      time: (i / 36) * duration,
      value: [
        Math.cos((i / 36) * Math.PI * 2) * radius,
        height,
        Math.sin((i / 36) * Math.PI * 2) * radius,
      ],
      easing: 'linear' as EasingType,
    })),
  }),

  cameraZoomIn: (duration = 2, startFov = 75, endFov = 35): AnimationTrackConfig => ({
    id: 'cameraZoomIn',
    targetId: ', ',
    property: 'fov',
    keyframes: [
      { time: 0, value: startFov },
      { time: duration, value: endFov, easing: 'easeInOutCubic' },
    ],
  }),
};

// ============================================================================
// Scene Animation Service
// ============================================================================

class SceneAnimationService {
  private animatedObjects: Map<string, AnimatedObject> = new Map();
  private clock: THREE.Clock = new THREE.Clock();
  private listeners: Set<(state: Map<string, AnimationState>) => void> = new Set();
  private frameId: number | null = null;
  private globalSpeed: number = 1;
  private isGloballyPlaying: boolean = false;

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  registerObject(id: string, object: THREE.Object3D): AnimatedObject {
    if (this.animatedObjects.has(id)) {
      return this.animatedObjects.get(id)!;
    }

    const mixer = new THREE.AnimationMixer(object);
    const animatedObject: AnimatedObject = {
      id,
      object,
      mixer,
      clips: new Map(),
      actions: new Map(),
      state: {
        isPlaying: false,
        isPaused: false,
        currentTime: 0,
        duration: 0,
        speed: 1,
        loop: false,
      },
    };

    this.animatedObjects.set(id, animatedObject);
    return animatedObject;
  }

  unregisterObject(id: string): void {
    const obj = this.animatedObjects.get(id);
    if (obj) {
      obj.mixer.stopAllAction();
      obj.mixer.uncacheRoot(obj.object);
      this.animatedObjects.delete(id);
    }
  }

  getAnimatedObject(id: string): AnimatedObject | undefined {
    return this.animatedObjects.get(id);
  }

  // -------------------------------------------------------------------------
  // Track Creation
  // -------------------------------------------------------------------------

  createKeyframeTrack(config: AnimationTrackConfig): THREE.KeyframeTrack | null {
    const { targetId, property, keyframes, interpolation } = config;
    
    if (keyframes.length === 0) return null;

    const times: number[] = keyframes.map((kf) => kf.time);
    let values: number[] = [];
    let TrackClass: typeof THREE.KeyframeTrack = THREE.KeyframeTrack;
    let trackName = `.${property}`;

    switch (property) {
      case 'position':
        TrackClass = THREE.VectorKeyframeTrack;
        values = keyframes.flatMap((kf) => kf.value as number[]);
        break;

      case 'rotation':
        // Convert Euler to Quaternion for smooth interpolation
        TrackClass = THREE.QuaternionKeyframeTrack;
        trackName = '.quaternion';
        values = keyframes.flatMap((kf) => {
          const euler = kf.value as [number, number, number, string?];
          const q = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(euler[0], euler[1], euler[2], euler[3] || 'XYZ')
          );
          return [q.x, q.y, q.z, q.w];
        });
        break;

      case 'scale':
        TrackClass = THREE.VectorKeyframeTrack;
        values = keyframes.flatMap((kf) => kf.value as number[]);
        break;

      case 'opacity':
        TrackClass = THREE.NumberKeyframeTrack;
        trackName = '.material.opacity';
        values = keyframes.map((kf) => kf.value as number);
        break;

      case 'intensity':
        TrackClass = THREE.NumberKeyframeTrack;
        values = keyframes.map((kf) => kf.value as number);
        break;

      case 'fov':
        TrackClass = THREE.NumberKeyframeTrack;
        values = keyframes.map((kf) => kf.value as number);
        break;

      case 'color':
        TrackClass = THREE.ColorKeyframeTrack;
        values = keyframes.flatMap((kf) => {
          const color = new THREE.Color(kf.value as string | number);
          return [color.r, color.g, color.b];
        });
        break;

      default:
        log.warn(`Unknown property: ${property}`);
        return null;
    }

    const track = new TrackClass(trackName, times, values);
    
    if (interpolation !== undefined) {
      track.setInterpolation(interpolation);
    }

    return track;
  }

  // -------------------------------------------------------------------------
  // Clip Creation
  // -------------------------------------------------------------------------

  createAnimationClip(config: AnimationClipConfig): THREE.AnimationClip | null {
    const tracks: THREE.KeyframeTrack[] = [];

    for (const trackConfig of config.tracks) {
      const track = this.createKeyframeTrack(trackConfig);
      if (track) {
        tracks.push(track);
      }
    }

    if (tracks.length === 0) return null;

    const clip = new THREE.AnimationClip(config.name, config.duration, tracks);
    return clip;
  }

  // -------------------------------------------------------------------------
  // Animation Control
  // -------------------------------------------------------------------------

  addAnimation(
    objectId: string,
    clipConfig: AnimationClipConfig
  ): THREE.AnimationAction | null {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) {
      log.warn(`Object ${objectId} not registered`);
      return null;
    }

    const clip = this.createAnimationClip(clipConfig);
    if (!clip) return null;

    animatedObject.clips.set(clipConfig.id, clip);

    const action = animatedObject.mixer.clipAction(clip);
    animatedObject.actions.set(clipConfig.id, action);

    // Configure loop
    if (clipConfig.loop !== undefined) {
      action.setLoop(clipConfig.loop, clipConfig.loopCount ?? Infinity);
    }

    // Update state
    animatedObject.state.duration = Math.max(
      animatedObject.state.duration,
      clip.duration
    );

    return action;
  }

  removeAnimation(objectId: string, clipId: string): void {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) return;

    const action = animatedObject.actions.get(clipId);
    if (action) {
      action.stop();
      animatedObject.mixer.uncacheAction(action.getClip());
    }

    animatedObject.clips.delete(clipId);
    animatedObject.actions.delete(clipId);
  }

  // -------------------------------------------------------------------------
  // Playback Control
  // -------------------------------------------------------------------------

  play(objectId: string, clipId?: string): void {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) return;

    if (clipId) {
      const action = animatedObject.actions.get(clipId);
      if (action) {
        action.reset();
        action.play();
      }
    } else {
      // Play all animations
      animatedObject.actions.forEach((action) => {
        action.reset();
        action.play();
      });
    }

    animatedObject.state.isPlaying = true;
    animatedObject.state.isPaused = false;
    this.startRenderLoop();
    this.notify();
  }

  pause(objectId: string): void {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) return;

    animatedObject.actions.forEach((action) => {
      action.paused = true;
    });

    animatedObject.state.isPaused = true;
    this.notify();
  }

  resume(objectId: string): void {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) return;

    animatedObject.actions.forEach((action) => {
      action.paused = false;
    });

    animatedObject.state.isPaused = false;
    this.notify();
  }

  stop(objectId: string): void {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) return;

    animatedObject.actions.forEach((action) => {
      action.stop();
    });

    animatedObject.state.isPlaying = false;
    animatedObject.state.isPaused = false;
    animatedObject.state.currentTime = 0;
    this.notify();
  }

  setTime(objectId: string, time: number): void {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) return;

    animatedObject.mixer.setTime(time);
    animatedObject.state.currentTime = time;
    this.notify();
  }

  setSpeed(objectId: string, speed: number): void {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) return;

    animatedObject.actions.forEach((action) => {
      action.timeScale = speed;
    });

    animatedObject.state.speed = speed;
    this.notify();
  }

  setLoop(objectId: string, loop: boolean, loopStyle?: THREE.AnimationActionLoopStyles): void {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) return;

    animatedObject.actions.forEach((action) => {
      action.setLoop(
        loopStyle ?? (loop ? THREE.LoopRepeat : THREE.LoopOnce),
        Infinity
      );
      action.clampWhenFinished = !loop;
    });

    animatedObject.state.loop = loop;
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Crossfade
  // -------------------------------------------------------------------------

  crossfade(
    objectId: string,
    fromClipId: string,
    toClipId: string,
    duration: number = 0.5
  ): void {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) return;

    const fromAction = animatedObject.actions.get(fromClipId);
    const toAction = animatedObject.actions.get(toClipId);

    if (!fromAction || !toAction) return;

    toAction.reset();
    toAction.play();
    fromAction.crossFadeTo(toAction, duration, true);
  }

  // -------------------------------------------------------------------------
  // Global Control
  // -------------------------------------------------------------------------

  playAll(): void {
    this.isGloballyPlaying = true;
    this.animatedObjects.forEach((_, id) => this.play(id));
    this.startRenderLoop();
  }

  pauseAll(): void {
    this.animatedObjects.forEach((_, id) => this.pause(id));
  }

  stopAll(): void {
    this.isGloballyPlaying = false;
    this.animatedObjects.forEach((_, id) => this.stop(id));
    this.stopRenderLoop();
  }

  setGlobalSpeed(speed: number): void {
    this.globalSpeed = speed;
    this.animatedObjects.forEach((_, id) => this.setSpeed(id, speed));
  }

  setGlobalTime(time: number): void {
    this.animatedObjects.forEach((_, id) => this.setTime(id, time));
  }

  // -------------------------------------------------------------------------
  // Render Loop
  // -------------------------------------------------------------------------

  private startRenderLoop(): void {
    if (this.frameId !== null) return;

    const animate = () => {
      this.frameId = requestAnimationFrame(animate);
      this.update();
    };

    this.clock.start();
    animate();
  }

  private stopRenderLoop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.clock.stop();
  }

  update(externalDelta?: number): void {
    const delta = externalDelta ?? this.clock.getDelta();

    this.animatedObjects.forEach((animatedObject) => {
      if (animatedObject.state.isPlaying && !animatedObject.state.isPaused) {
        animatedObject.mixer.update(delta * this.globalSpeed);
        animatedObject.state.currentTime = 
          (animatedObject.mixer as any)._actions?.[0]?.time ?? 0;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  subscribe(listener: (state: Map<string, AnimationState>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const states = new Map<string, AnimationState>();
    this.animatedObjects.forEach((obj, id) => {
      states.set(id, { ...obj.state });
    });
    this.listeners.forEach((l) => l(states));
  }

  // -------------------------------------------------------------------------
  // State Access
  // -------------------------------------------------------------------------

  getState(objectId: string): AnimationState | null {
    return this.animatedObjects.get(objectId)?.state ?? null;
  }

  getAllStates(): Map<string, AnimationState> {
    const states = new Map<string, AnimationState>();
    this.animatedObjects.forEach((obj, id) => {
      states.set(id, { ...obj.state });
    });
    return states;
  }

  isAnyPlaying(): boolean {
    for (const [, obj] of this.animatedObjects) {
      if (obj.state.isPlaying && !obj.state.isPaused) return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  serializeClipConfig(objectId: string, clipId: string): AnimationClipConfig | null {
    const animatedObject = this.animatedObjects.get(objectId);
    if (!animatedObject) return null;

    const clip = animatedObject.clips.get(clipId);
    if (!clip) return null;

    const tracks: AnimationTrackConfig[] = clip.tracks.map((track, index) => {
      const times = Array.from(track.times);
      const values = Array.from(track.values);
      
      let property: AnimationTrackConfig['property'] = 'position';
      let keyframes: Keyframe[] = [];

      if (track.name.includes('position')) {
        property = 'position';
        keyframes = times.map((time, i) => ({
          time,
          value: [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]],
        }));
      } else if (track.name.includes('quaternion')) {
        property = 'rotation';
        keyframes = times.map((time, i) => {
          const q = new THREE.Quaternion(
            values[i * 4],
            values[i * 4 + 1],
            values[i * 4 + 2],
            values[i * 4 + 3]
          );
          const euler = new THREE.Euler().setFromQuaternion(q);
          return { time, value: [euler.x, euler.y, euler.z'XYZ'] };
        });
      } else if (track.name.includes('scale')) {
        property = 'scale';
        keyframes = times.map((time, i) => ({
          time,
          value: [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]],
        }));
      } else if (track.name.includes('opacity')) {
        property = 'opacity';
        keyframes = times.map((time, i) => ({ time, value: values[i] }));
      } else if (track.name.includes('intensity')) {
        property ='intensity';
        keyframes = times.map((time, i) => ({ time, value: values[i] }));
      }

      return {
        id: `track_${index}`,
        targetId: objectId,
        property,
        keyframes,
      };
    });

    return {
      id: clipId,
      name: clip.name,
      duration: clip.duration,
      tracks,
    };
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  applyPreset(
    objectId: string,
    presetName: keyof typeof ANIMATION_PRESETS,
    ...args: any[]
  ): THREE.AnimationAction | null {
    const presetFn = ANIMATION_PRESETS[presetName] as (...args: any[]) => AnimationTrackConfig;
    if (!presetFn) {
      log.warn(`Unknown preset: ${presetName}`);
      return null;
    }

    const trackConfig = presetFn(...args);
    trackConfig.targetId = objectId;
    trackConfig.id = `${presetName}_${Date.now()}`;

    const clipConfig: AnimationClipConfig = {
      id: `clip_${presetName}_${Date.now()}`,
      name: presetName,
      duration: trackConfig.keyframes[trackConfig.keyframes.length - 1]?.time ?? 1,
      tracks: [trackConfig],
    };

    return this.addAnimation(objectId, clipConfig);
  }

  clear(): void {
    this.stopAll();
    this.animatedObjects.forEach((obj) => {
      obj.mixer.stopAllAction();
    });
    this.animatedObjects.clear();
    this.notify();
  }
}

// Export singleton
export const sceneAnimationService = new SceneAnimationService();

export default sceneAnimationService;

