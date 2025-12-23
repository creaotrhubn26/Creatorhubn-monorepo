/**
 * SceneGraphAnimationEngine - Professional Animation Pipeline
 * 
 * Full scene graph animation system with:
 * - Node transforms + custom parameters
 * - Multi-track animation
 * - Keyframe management with curves
 * - Animation mixer with conflict resolution
 * - Light simulation updates
 * - Parameter animation (power, color temp, zoom, etc.)
 * - Procedural physics animation
 * - Camera exposure simulation
 * - Export pipeline
 */

import * as THREE from 'three';

// ============================================================================
// Types & Interfaces
// ============================================================================

// Easing types
export type EasingFunction = (t: number) => number;

export type EasingName = 
  | 'linear' | 'step'
  | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
  | 'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic'
  | 'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce'
  | 'easeInBack' | 'easeOutBack' | 'easeInOutBack';

// Keyframe
export interface Keyframe<T = number> {
  time: number;
  value: T;
  easing: EasingName;
  tangentIn?: T;   // For bezier curves
  tangentOut?: T;
}

// Track types
export type TrackType = 
  | 'position' | 'rotation' | 'scale'
  | 'lightPower' | 'lightColor' | 'colorTemperature' | 'beamAngle'
  | 'focalLength' | 'aperture' | 'focusDistance' | 'iso' | 'shutterSpeed'
  | 'goboRotation' | 'zoom' | 'tilt' | 'pan'
  | 'opacity' | 'visibility'
  | 'custom';

// Animation Track
export interface AnimationTrack {
  id: string;
  nodeId: string;
  type: TrackType;
  propertyPath: string;        // e.g.'light.power', 'camera.focalLength'
  keyframes: Keyframe<any>[];
  enabled: boolean;
  blendMode: 'override' | 'additive' | 'multiply';
  weight: number;              // 0-1 for blending
  loop: boolean;
  loopCount: number;           // -1 for infinite
}

// Scene Graph Node
export interface SceneGraphNode {
  id: string;
  name: string;
  type: 'light' | 'camera' | 'object' | 'group' | 'actor';
  
  // Transforms
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  
  // Custom parameters (based on type)
  parameters: Record<string, any>;
  
  // Animation state
  animatedValues: Map<string, any>;
  
  // Hierarchy
  parentId?: string;
  childIds: string[];
  
  // Metadata
  visible: boolean;
  locked: boolean;
  
  // Three.js reference
  object3D?: THREE.Object3D;
}

// Light-specific parameters
export interface LightParameters {
  power: number;           // Watts or Ws
  colorTemperature: number; // Kelvin
  color: THREE.Color;
  beamAngle: number;       // Degrees
  falloff: number;
  modelingLight: number;   // 0-1
  iesProfile?: string;
  goboPattern?: string;
  goboRotation: number;
  zoom: number;            // For Fresnel
  diffusion: number;       // 0-1
}

// Camera-specific parameters
export interface CameraParameters {
  focalLength: number;     // mm
  aperture: number;        // f-stop
  focusDistance: number;   // meters
  iso: number;
  shutterSpeed: number;    // seconds
  sensorWidth: number;     // mm
  sensorHeight: number;    // mm
}

// Animation Clip
export interface AnimationClip {
  id: string;
  name: string;
  duration: number;
  tracks: AnimationTrack[];
  fps: number;
  loop: boolean;
}

// Animation State
export interface AnimationPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  loop: boolean;
}

// ============================================================================
// Easing Functions
// ============================================================================

export const EASING_FUNCTIONS: Record<EasingName, EasingFunction> = {
  linear: (t) => t,
  step: (t) => t < 1 ? 0 : 1,
  
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  
  easeInQuart: (t) => t * t * t * t,
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  
  easeInElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI) / 3);
  },
  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
  },
  easeInOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2 + 1;
  },
  
  easeInBounce: (t) => 1 - EASING_FUNCTIONS.easeOutBounce(1 - t),
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  easeInOutBounce: (t) => t < 0.5
    ? (1 - EASING_FUNCTIONS.easeOutBounce(1 - 2 * t)) / 2
    : (1 + EASING_FUNCTIONS.easeOutBounce(2 * t - 1)) / 2,
  
  easeInBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
};

// ============================================================================
// Curve Evaluator
// ============================================================================

class CurveEvaluator {
  /**
   * Evaluate a value at a specific time from keyframes
   */
  static evaluate<T>(
    keyframes: Keyframe<T>[],
    time: number,
    interpolate: (a: T, b: T, t: number) => T
  ): T {
    if (keyframes.length === 0) {
      throw new Error('No keyframes, ');
    }

    // Before first keyframe
    if (time <= keyframes[0].time) {
      return keyframes[0].value;
    }

    // After last keyframe
    if (time >= keyframes[keyframes.length - 1].time) {
      return keyframes[keyframes.length - 1].value;
    }

    // Find surrounding keyframes
    let prevKey = keyframes[0];
    let nextKey = keyframes[1];

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (time >= keyframes[i].time && time < keyframes[i + 1].time) {
        prevKey = keyframes[i];
        nextKey = keyframes[i + 1];
        break;
      }
    }

    // Calculate normalized time
    const duration = nextKey.time - prevKey.time;
    const localTime = (time - prevKey.time) / duration;

    // Apply easing
    const easingFn = EASING_FUNCTIONS[prevKey.easing] || EASING_FUNCTIONS.linear;
    const easedTime = easingFn(localTime);

    // Interpolate
    return interpolate(prevKey.value, nextKey.value, easedTime);
  }

  /**
   * Interpolate numbers
   */
  static lerpNumber(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Interpolate Vector3
   */
  static lerpVector3(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
    return new THREE.Vector3().lerpVectors(a, b, t);
  }

  /**
   * Interpolate Euler (convert to quaternion for smooth interpolation)
   */
  static lerpEuler(a: THREE.Euler, b: THREE.Euler, t: number): THREE.Euler {
    const qa = new THREE.Quaternion().setFromEuler(a);
    const qb = new THREE.Quaternion().setFromEuler(b);
    const qr = new THREE.Quaternion().slerpQuaternions(qa, qb, t);
    return new THREE.Euler().setFromQuaternion(qr);
  }

  /**
   * Interpolate Color
   */
  static lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
    return new THREE.Color().lerpColors(a, b, t);
  }
}

// ============================================================================
// Animation Mixer
// ============================================================================

class AnimationMixer {
  private activeClips: Map<string, { clip: AnimationClip; state: AnimationPlaybackState }> = new Map();
  private trackValues: Map<string, Map<string, any>> = new Map(); // nodeId -> propertyPath -> value

  /**
   * Add a clip to the mixer
   */
  addClip(clip: AnimationClip): void {
    this.activeClips.set(clip.id, {
      clip,
      state: {
        isPlaying: false,
        isPaused: false,
        currentTime: 0,
        duration: clip.duration,
        speed: 1,
        loop: clip.loop,
      },
    });
  }

  /**
   * Remove a clip
   */
  removeClip(clipId: string): void {
    this.activeClips.delete(clipId);
  }

  /**
   * Play a clip
   */
  play(clipId: string, fromStart = true): void {
    const entry = this.activeClips.get(clipId);
    if (!entry) return;

    if (fromStart) {
      entry.state.currentTime = 0;
    }
    entry.state.isPlaying = true;
    entry.state.isPaused = false;
  }

  /**
   * Pause a clip
   */
  pause(clipId: string): void {
    const entry = this.activeClips.get(clipId);
    if (!entry) return;
    entry.state.isPaused = true;
  }

  /**
   * Stop a clip
   */
  stop(clipId: string): void {
    const entry = this.activeClips.get(clipId);
    if (!entry) return;
    entry.state.isPlaying = false;
    entry.state.isPaused = false;
    entry.state.currentTime = 0;
  }

  /**
   * Update the mixer (call every frame)
   */
  update(deltaTime: number): Map<string, Map<string, any>> {
    this.trackValues.clear();

    for (const [clipId, { clip, state }] of this.activeClips) {
      if (!state.isPlaying || state.isPaused) continue;

      // Advance time
      state.currentTime += deltaTime * state.speed;

      // Handle looping
      if (state.currentTime >= state.duration) {
        if (state.loop) {
          state.currentTime = state.currentTime % state.duration;
        } else {
          state.currentTime = state.duration;
          state.isPlaying = false;
        }
      }

      // Evaluate all tracks
      for (const track of clip.tracks) {
        if (!track.enabled) continue;

        const value = this.evaluateTrack(track, state.currentTime);
        if (value === undefined) continue;

        // Store value for this node/property
        if (!this.trackValues.has(track.nodeId)) {
          this.trackValues.set(track.nodeId, new Map());
        }
        
        const nodeValues = this.trackValues.get(track.nodeId)!;
        const existingValue = nodeValues.get(track.propertyPath);

        // Blend values if multiple tracks affect same property
        if (existingValue !== undefined) {
          nodeValues.set(track.propertyPath, this.blendValues(
            existingValue,
            value,
            track.blendMode,
            track.weight
          ));
        } else {
          nodeValues.set(track.propertyPath, value);
        }
      }
    }

    return this.trackValues;
  }

  /**
   * Evaluate a track at a specific time
   */
  private evaluateTrack(track: AnimationTrack, time: number): any {
    if (track.keyframes.length === 0) return undefined;

    const type = track.type;

    switch (type) {
      case 'position':
      case 'scale':
        return CurveEvaluator.evaluate(
          track.keyframes as Keyframe<THREE.Vector3>[],
          time,
          CurveEvaluator.lerpVector3
        );
      
      case 'rotation':
        return CurveEvaluator.evaluate(
          track.keyframes as Keyframe<THREE.Euler>[],
          time,
          CurveEvaluator.lerpEuler
        );
      
      case 'lightColor':
        return CurveEvaluator.evaluate(
          track.keyframes as Keyframe<THREE.Color>[],
          time,
          CurveEvaluator.lerpColor
        );
      
      default:
        return CurveEvaluator.evaluate(
          track.keyframes as Keyframe<number>[],
          time,
          CurveEvaluator.lerpNumber
        );
    }
  }

  /**
   * Blend two values based on blend mode
   */
  private blendValues(existing: any, incoming: any, mode: AnimationTrack['blendMode'], weight: number): any {
    if (typeof existing === 'number' && typeof incoming === 'number') {
      switch (mode) {
        case 'additive':
          return existing + incoming * weight;
        case 'multiply':
          return existing * (1 + (incoming - 1) * weight);
        case 'override':
        default:
          return existing * (1 - weight) + incoming * weight;
      }
    }

    if (existing instanceof THREE.Vector3 && incoming instanceof THREE.Vector3) {
      switch (mode) {
        case 'additive':
          return existing.clone().addScaledVector(incoming, weight);
        case 'override':
        default:
          return existing.clone().lerp(incoming, weight);
      }
    }

    // For other types, just use override
    return weight >= 0.5 ? incoming : existing;
  }

  /**
   * Get playback state
   */
  getState(clipId: string): AnimationPlaybackState | null {
    return this.activeClips.get(clipId)?.state ?? null;
  }

  /**
   * Set time for a clip
   */
  setTime(clipId: string, time: number): void {
    const entry = this.activeClips.get(clipId);
    if (entry) {
      entry.state.currentTime = Math.max(0, Math.min(time, entry.state.duration));
    }
  }

  /**
   * Set speed for a clip
   */
  setSpeed(clipId: string, speed: number): void {
    const entry = this.activeClips.get(clipId);
    if (entry) {
      entry.state.speed = speed;
    }
  }
}

// ============================================================================
// Procedural Animation (Physics-based)
// ============================================================================

interface SpringState {
  position: number;
  velocity: number;
  target: number;
}

class ProceduralAnimator {
  private springs: Map<string, SpringState> = new Map();
  
  // Spring constants
  private stiffness = 150;
  private damping = 12;

  /**
   * Create a spring for an object
   */
  createSpring(id: string, initialValue: number): void {
    this.springs.set(id, {
      position: initialValue,
      velocity: 0,
      target: initialValue,
    });
  }

  /**
   * Set spring target
   */
  setTarget(id: string, target: number): void {
    const spring = this.springs.get(id);
    if (spring) {
      spring.target = target;
    }
  }

  /**
   * Update spring physics
   */
  update(deltaTime: number): Map<string, number> {
    const results = new Map<string, number>();

    for (const [id, spring] of this.springs) {
      // Spring force
      const displacement = spring.target - spring.position;
      const springForce = displacement * this.stiffness;
      
      // Damping force
      const dampingForce = -spring.velocity * this.damping;
      
      // Total force
      const force = springForce + dampingForce;
      
      // Update velocity and position
      spring.velocity += force * deltaTime;
      spring.position += spring.velocity * deltaTime;
      
      results.set(id, spring.position);
    }

    return results;
  }

  /**
   * Apply impulse (e.g., when moving a stand)
   */
  applyImpulse(id: string, impulse: number): void {
    const spring = this.springs.get(id);
    if (spring) {
      spring.velocity += impulse;
    }
  }

  /**
   * Create jiggle effect
   */
  jiggle(id: string, intensity: number = 1): void {
    this.applyImpulse(id, (Math.random() - 0.5) * intensity);
  }
}

// ============================================================================
// Exposure Calculator for Camera Animation
// ============================================================================

class ExposureSimulator {
  /**
   * Calculate EV (Exposure Value)
   */
  static calculateEV(aperture: number, shutterSpeed: number, iso: number): number {
    return Math.log2((aperture * aperture) / shutterSpeed) - Math.log2(iso / 100);
  }

  /**
   * Calculate brightness from lights
   */
  static calculateSceneBrightness(lights: Array<{ power: number; distance: number }>): number {
    let totalLux = 0;
    
    for (const light of lights) {
      // Inverse square law
      const lux = (light.power * 683) / (4 * Math.PI * light.distance * light.distance);
      totalLux += lux;
    }

    // Convert lux to EV (approximately)
    return Math.log2(totalLux / 2.5);
  }

  /**
   * Calculate exposure compensation needed
   */
  static calculateExposureCompensation(
    cameraEV: number,
    sceneBrightness: number
  ): number {
    return sceneBrightness - cameraEV;
  }

  /**
   * Apply exposure to render brightness
   */
  static applyExposure(ev: number): number {
    // Convert EV to luminance multiplier
    return Math.pow(2, -ev);
  }
}

// ============================================================================
// Scene Graph Animation Engine (Main Class)
// ============================================================================

export class SceneGraphAnimationEngine {
  private nodes: Map<string, SceneGraphNode> = new Map();
  private clips: Map<string, AnimationClip> = new Map();
  private mixer: AnimationMixer;
  private proceduralAnimator: ProceduralAnimator;
  
  // Clock
  private clock: THREE.Clock;
  private frameId: number | null = null;
  
  // Callbacks
  private onUpdate: ((nodes: Map<string, SceneGraphNode>) => void) | null = null;
  private onLightUpdate: ((nodeId: string, params: LightParameters) => void) | null = null;
  private onCameraUpdate: ((nodeId: string, params: CameraParameters, exposure: number) => void) | null = null;
  
  // State
  private isRunning = false;
  private globalTime = 0;
  private globalSpeed = 1;

  // Export state
  private isExporting = false;
  private exportFrames: ImageData[] = [];
  private exportFps = 30;

  constructor() {
    this.mixer = new AnimationMixer();
    this.proceduralAnimator = new ProceduralAnimator();
    this.clock = new THREE.Clock();
  }

  // -------------------------------------------------------------------------
  // Node Management
  // -------------------------------------------------------------------------

  registerNode(node: SceneGraphNode): void {
    this.nodes.set(node.id, node);
    
    // Create procedural springs for jiggly elements
    if (node.type === 'light') {
      this.proceduralAnimator.createSpring(`${node.id}_sway`, 0);
    }
  }

  unregisterNode(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  getNode(nodeId: string): SceneGraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): SceneGraphNode[] {
    return Array.from(this.nodes.values());
  }

  // -------------------------------------------------------------------------
  // Clip Management
  // -------------------------------------------------------------------------

  createClip(config: Partial<AnimationClip> & { name: string }): AnimationClip {
    const clip: AnimationClip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: config.name,
      duration: config.duration ?? 5,
      tracks: config.tracks ?? [],
      fps: config.fps ?? 30,
      loop: config.loop ?? false,
    };

    this.clips.set(clip.id, clip);
    this.mixer.addClip(clip);

    return clip;
  }

  deleteClip(clipId: string): void {
    this.clips.delete(clipId);
    this.mixer.removeClip(clipId);
  }

  getClip(clipId: string): AnimationClip | undefined {
    return this.clips.get(clipId);
  }

  // -------------------------------------------------------------------------
  // Track Management
  // -------------------------------------------------------------------------

  addTrack(clipId: string, track: Omit<AnimationTrack, 'id'>): AnimationTrack | null {
    const clip = this.clips.get(clipId);
    if (!clip) return null;

    const newTrack: AnimationTrack = {
      ...track,
      id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    clip.tracks.push(newTrack);
    return newTrack;
  }

  removeTrack(clipId: string, trackId: string): void {
    const clip = this.clips.get(clipId);
    if (!clip) return;

    clip.tracks = clip.tracks.filter((t) => t.id !== trackId);
  }

  // -------------------------------------------------------------------------
  // Keyframe Management
  // -------------------------------------------------------------------------

  addKeyframe(clipId: string, trackId: string, keyframe: Keyframe): void {
    const clip = this.clips.get(clipId);
    if (!clip) return;

    const track = clip.tracks.find((t) => t.id === trackId);
    if (!track) return;

    // Insert keyframe in sorted order
    const insertIndex = track.keyframes.findIndex((kf) => kf.time > keyframe.time);
    if (insertIndex === -1) {
      track.keyframes.push(keyframe);
    } else {
      track.keyframes.splice(insertIndex, 0, keyframe);
    }
  }

  removeKeyframe(clipId: string, trackId: string, time: number): void {
    const clip = this.clips.get(clipId);
    if (!clip) return;

    const track = clip.tracks.find((t) => t.id === trackId);
    if (!track) return;

    track.keyframes = track.keyframes.filter((kf) => kf.time !== time);
  }

  moveKeyframe(clipId: string, trackId: string, oldTime: number, newTime: number): void {
    const clip = this.clips.get(clipId);
    if (!clip) return;

    const track = clip.tracks.find((t) => t.id === trackId);
    if (!track) return;

    const keyframe = track.keyframes.find((kf) => kf.time === oldTime);
    if (keyframe) {
      keyframe.time = newTime;
      // Re-sort
      track.keyframes.sort((a, b) => a.time - b.time);
    }
  }

  // -------------------------------------------------------------------------
  // Playback Control
  // -------------------------------------------------------------------------

  play(clipId?: string): void {
    if (clipId) {
      this.mixer.play(clipId);
    } else {
      // Play all clips
      for (const id of this.clips.keys()) {
        this.mixer.play(id);
      }
    }

    this.startLoop();
  }

  pause(clipId?: string): void {
    if (clipId) {
      this.mixer.pause(clipId);
    } else {
      for (const id of this.clips.keys()) {
        this.mixer.pause(id);
      }
    }
  }

  stop(clipId?: string): void {
    if (clipId) {
      this.mixer.stop(clipId);
    } else {
      for (const id of this.clips.keys()) {
        this.mixer.stop(id);
      }
    }
  }

  setTime(time: number, clipId?: string): void {
    if (clipId) {
      this.mixer.setTime(clipId, time);
    } else {
      for (const id of this.clips.keys()) {
        this.mixer.setTime(id, time);
      }
    }
    this.globalTime = time;
  }

  setSpeed(speed: number, clipId?: string): void {
    if (clipId) {
      this.mixer.setSpeed(clipId, speed);
    } else {
      for (const id of this.clips.keys()) {
        this.mixer.setSpeed(id, speed);
      }
    }
    this.globalSpeed = speed;
  }

  // -------------------------------------------------------------------------
  // Animation Loop
  // -------------------------------------------------------------------------

  private startLoop(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.animate();
  }

  private stopLoop(): void {
    this.isRunning = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.clock.stop();
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    this.frameId = requestAnimationFrame(this.animate);

    const deltaTime = this.clock.getDelta() * this.globalSpeed;
    this.globalTime += deltaTime;

    // Update mixer
    const animatedValues = this.mixer.update(deltaTime);

    // Update procedural animations
    const proceduralValues = this.proceduralAnimator.update(deltaTime);

    // Apply animated values to nodes
    this.applyAnimatedValues(animatedValues);

    // Apply procedural values
    this.applyProceduralValues(proceduralValues);

    // Update light simulations
    this.updateLightSimulations();

    // Update camera exposure
    this.updateCameraExposure();

    // Callback
    if (this.onUpdate) {
      this.onUpdate(this.nodes);
    }
  };

  private applyAnimatedValues(values: Map<string, Map<string, any>>): void {
    for (const [nodeId, propertyMap] of values) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      for (const [propertyPath, value] of propertyMap) {
        this.setNodeProperty(node, propertyPath, value);
      }
    }
  }

  private setNodeProperty(node: SceneGraphNode, path: string, value: any): void {
    const parts = path.split('.');
    
    if (parts[0] === 'position' && value instanceof THREE.Vector3) {
      node.position.copy(value);
    } else if (parts[0] === 'rotation' && value instanceof THREE.Euler) {
      node.rotation.copy(value);
    } else if (parts[0] === 'scale' && value instanceof THREE.Vector3) {
      node.scale.copy(value);
    } else {
      // Set in parameters
      let target: any = node.parameters;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
    }

    // Store animated value
    node.animatedValues.set(path, value);

    // Update Three.js object
    if (node.object3D) {
      node.object3D.position.copy(node.position);
      node.object3D.rotation.copy(node.rotation);
      node.object3D.scale.copy(node.scale);
    }
  }

  private applyProceduralValues(values: Map<string, number>): void {
    for (const [id, value] of values) {
      const [nodeId, property] = id.split('_');
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      if (property === 'sway' && node.object3D) {
        // Apply subtle rotation sway
        node.object3D.rotation.z = value * 0.01;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Light Simulation
  // -------------------------------------------------------------------------

  private updateLightSimulations(): void {
    for (const [nodeId, node] of this.nodes) {
      if (node.type !== 'light') continue;

      const params = node.parameters as LightParameters;
      
      if (this.onLightUpdate) {
        this.onLightUpdate(nodeId, params);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Camera Exposure Simulation
  // -------------------------------------------------------------------------

  private updateCameraExposure(): void {
    // Collect light data
    const lights: Array<{ power: number; distance: number }> = [];
    const cameraNodes: SceneGraphNode[] = [];

    for (const node of this.nodes.values()) {
      if (node.type === 'light') {
        const params = node.parameters as LightParameters;
        lights.push({
          power: params.power,
          distance: 3, // Would calculate actual distance to subject
        });
      } else if (node.type === 'camera') {
        cameraNodes.push(node);
      }
    }

    // Calculate scene brightness
    const sceneBrightness = ExposureSimulator.calculateSceneBrightness(lights);

    // Update each camera
    for (const cameraNode of cameraNodes) {
      const params = cameraNode.parameters as CameraParameters;
      
      const cameraEV = ExposureSimulator.calculateEV(
        params.aperture,
        params.shutterSpeed,
        params.iso
      );

      const exposureMultiplier = ExposureSimulator.applyExposure(
        ExposureSimulator.calculateExposureCompensation(cameraEV, sceneBrightness)
      );

      if (this.onCameraUpdate) {
        this.onCameraUpdate(cameraNode.id, params, exposureMultiplier);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Export Pipeline
  // -------------------------------------------------------------------------

  async exportVideo(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    clipId: string,
    options: {
      fps?: number;
      width?: number;
      height?: number;
      format?: 'mp4' | 'webm';
      quality?: number;
    } = {}
  ): Promise<Blob> {
    const clip = this.clips.get(clipId);
    if (!clip) throw new Error('Clip not found');

    const fps = options.fps ?? 30;
    const width = options.width ?? 1920;
    const height = options.height ?? 1080;
    const totalFrames = Math.ceil(clip.duration * fps);

    // Set renderer size
    renderer.setSize(width, height);

    // Render each frame
    const frames: Blob[] = [];

    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame / fps;
      
      // Set animation time
      this.setTime(time, clipId);
      
      // Update the animation (single frame)
      const animatedValues = this.mixer.update(0);
      this.applyAnimatedValues(animatedValues);
      
      // Update Three.js objects
      for (const node of this.nodes.values()) {
        if (node.object3D) {
          node.object3D.position.copy(node.position);
          node.object3D.rotation.copy(node.rotation);
          node.object3D.scale.copy(node.scale);
        }
      }
      
      // Render frame
      renderer.render(scene, camera);
      
      // Capture frame
      const dataUrl = renderer.domElement.toDataURL('image/png');
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      frames.push(blob);
    }

    // Encode to video (using MediaRecorder API)
    return this.encodeFramesToVideo(frames, fps, options.format ?? 'webm');
  }

  private async encodeFramesToVideo(frames: Blob[], fps: number, format: string): Promise<Blob> {
    // Create a canvas for video encoding
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Get dimensions from first frame
    const firstImg = await createImageBitmap(frames[0]);
    canvas.width = firstImg.width;
    canvas.height = firstImg.height;

    // Use MediaRecorder with canvas capture
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: format === 'mp4' ? 'video/mp4' : 'video/webm',
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: `video/${format}` });
        resolve(blob);
      };

      recorder.start();

      // Draw frames
      let frameIndex = 0;
      const drawFrame = async () => {
        if (frameIndex >= frames.length) {
          recorder.stop();
          return;
        }

        const img = await createImageBitmap(frames[frameIndex]);
        ctx.drawImage(img, 0, 0);
        frameIndex++;

        setTimeout(drawFrame, 1000 / fps);
      };

      drawFrame();
    });
  }

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  setOnUpdate(callback: (nodes: Map<string, SceneGraphNode>) => void): void {
    this.onUpdate = callback;
  }

  setOnLightUpdate(callback: (nodeId: string, params: LightParameters) => void): void {
    this.onLightUpdate = callback;
  }

  setOnCameraUpdate(callback: (nodeId: string, params: CameraParameters, exposure: number) => void): void {
    this.onCameraUpdate = callback;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  serialize(): string {
    const data = {
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        ...node,
        position: node.position.toArray(),
        rotation: [node.rotation.x, node.rotation.y, node.rotation.z, node.rotation.order],
        scale: node.scale.toArray(),
        animatedValues: Array.from(node.animatedValues.entries()),
        object3D: undefined,
      })),
      clips: Array.from(this.clips.entries()).map(([id, clip]) => ({
        ...clip,
        tracks: clip.tracks.map((track) => ({
          ...track,
          keyframes: track.keyframes.map((kf) => ({
            ...kf,
            value: this.serializeValue(kf.value),
          })),
        })),
      })),
    };

    return JSON.stringify(data);
  }

  private serializeValue(value: any): any {
    if (value instanceof THREE.Vector3) {
      return { type: 'Vector3', data: value.toArray() };
    }
    if (value instanceof THREE.Euler) {
      return { type: 'Euler', data: [value.x, value.y, value.z, value.order] };
    }
    if (value instanceof THREE.Color) {
      return { type: 'Color', data: value.getHex() };
    }
    return value;
  }

  deserialize(json: string): void {
    const data = JSON.parse(json);

    // Restore nodes
    this.nodes.clear();
    for (const nodeData of data.nodes) {
      const node: SceneGraphNode = {
        ...nodeData,
        position: new THREE.Vector3().fromArray(nodeData.position),
        rotation: new THREE.Euler(nodeData.rotation[0], nodeData.rotation[1], nodeData.rotation[2], nodeData.rotation[3]),
        scale: new THREE.Vector3().fromArray(nodeData.scale),
        animatedValues: new Map(nodeData.animatedValues),
      };
      this.nodes.set(node.id, node);
    }

    // Restore clips
    this.clips.clear();
    for (const clipData of data.clips) {
      const clip: AnimationClip = {
        ...clipData,
        tracks: clipData.tracks.map((track: any) => ({
          ...track,
          keyframes: track.keyframes.map((kf: any) => ({
            ...kf,
            value: this.deserializeValue(kf.value),
          })),
        })),
      };
      this.clips.set(clip.id, clip);
      this.mixer.addClip(clip);
    }
  }

  private deserializeValue(value: any): any {
    if (value && typeof value === 'object' && 'type' in value) {
      switch (value.type) {
        case 'Vector3':
          return new THREE.Vector3().fromArray(value.data);
        case 'Euler':
          return new THREE.Euler(value.data[0], value.data[1], value.data[2], value.data[3]);
        case'Color':
          return new THREE.Color(value.data);
      }
    }
    return value;
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  getGlobalTime(): number {
    return this.globalTime;
  }

  isAnimating(): boolean {
    return this.isRunning;
  }

  dispose(): void {
    this.stopLoop();
    this.nodes.clear();
    this.clips.clear();
  }
}

// Export singleton instance
export const sceneGraphAnimationEngine = new SceneGraphAnimationEngine();

export default sceneGraphAnimationEngine;

