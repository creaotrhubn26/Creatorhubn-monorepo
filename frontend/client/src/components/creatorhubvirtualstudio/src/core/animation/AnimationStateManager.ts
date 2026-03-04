/**
 * AnimationStateManager - Connect animation tracks to 3D scene objects
 * 
 * Features:
 * - Binds tracks to Three.js objects
 * - Real-time property updates
 * - Interpolation between keyframes
 * - Support for all track types
 * - Event system for updates
 */

import * as THREE from 'three';
import type {
  AnimationTrack,
  Keyframe,
  EasingName} from './SceneGraphAnimationEngine';
import {
  AnimationClip,
  EASING_FUNCTIONS,
} from './SceneGraphAnimationEngine';

// ============================================================================
// Types
// ============================================================================

export interface SceneBinding {
  nodeId: string;
  object3D: THREE.Object3D;
  light?: THREE.Light;
  camera?: THREE.Camera;
  userData?: Record<string, any>;
}

export interface AnimationState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  loop: boolean;
}

export interface PropertyUpdate {
  nodeId: string;
  propertyPath: string;
  value: any;
  previousValue: any;
}

export type UpdateCallback = (updates: PropertyUpdate[]) => void;
export type StateChangeCallback = (state: AnimationState) => void;

// ============================================================================
// Easing Function Application
// ============================================================================

function applyEasing(t: number, easing: EasingName): number {
  const fn = EASING_FUNCTIONS[easing] || EASING_FUNCTIONS.linear;
  return fn(t);
}

// ============================================================================
// Value Interpolation
// ============================================================================

function interpolateValue(
  fromValue: any,
  toValue: any,
  t: number,
  trackType: string
): any {
  // Number interpolation
  if (typeof fromValue === 'number' && typeof toValue === 'number') {
    return fromValue + (toValue - fromValue) * t;
  }

  // Vector3 interpolation
  if (fromValue instanceof THREE.Vector3 && toValue instanceof THREE.Vector3) {
    return new THREE.Vector3().lerpVectors(fromValue, toValue, t);
  }

  // Plain object with x, y, z (position/scale)
  if (
    fromValue && toValue &&
    typeof fromValue === 'object' && typeof toValue === 'object' &&
    'x' in fromValue && 'y' in fromValue && 'z' in fromValue
  ) {
    return {
      x: fromValue.x + (toValue.x - fromValue.x) * t,
      y: fromValue.y + (toValue.y - fromValue.y) * t,
      z: fromValue.z + (toValue.z - fromValue.z) * t,
    };
  }

  // Euler/rotation interpolation
  if (fromValue instanceof THREE.Euler && toValue instanceof THREE.Euler) {
    const fromQuat = new THREE.Quaternion().setFromEuler(fromValue);
    const toQuat = new THREE.Quaternion().setFromEuler(toValue);
    fromQuat.slerp(toQuat, t);
    return new THREE.Euler().setFromQuaternion(fromQuat);
  }

  // Color interpolation
  if (fromValue instanceof THREE.Color && toValue instanceof THREE.Color) {
    return new THREE.Color().lerpColors(fromValue, toValue, t);
  }

  // String color interpolation
  if (typeof fromValue === 'string' && typeof toValue === 'string') {
    if (fromValue.startsWith('#') && toValue.startsWith('#')) {
      const from = new THREE.Color(fromValue);
      const to = new THREE.Color(toValue);
      return new THREE.Color().lerpColors(from, to, t);
    }
  }

  // Default: return toValue at t > 0.5, fromValue otherwise
  return t > 0.5 ? toValue : fromValue;
}

// ============================================================================
// Animation State Manager
// ============================================================================

export class AnimationStateManager {
  private bindings: Map<string, SceneBinding> = new Map();
  private tracks: AnimationTrack[] = [];
  private state: AnimationState = {
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
    speed: 1,
    loop: false,
  };
  private updateCallbacks: Set<UpdateCallback> = new Set();
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private initialValues: Map<string, Map<string, any>> = new Map();

  // -------------------------------------------------------------------------
  // Scene Binding
  // -------------------------------------------------------------------------

  bindObject(nodeId: string, object3D: THREE.Object3D): void {
    const binding: SceneBinding = {
      nodeId,
      object3D,
      light: object3D instanceof THREE.Light ? object3D : undefined,
      camera: object3D instanceof THREE.Camera ? object3D : undefined,
      userData: object3D.userData,
    };
    this.bindings.set(nodeId, binding);

    // Store initial values
    this.storeInitialValues(nodeId, object3D);
  }

  unbindObject(nodeId: string): void {
    this.bindings.delete(nodeId);
    this.initialValues.delete(nodeId);
  }

  getBinding(nodeId: string): SceneBinding | undefined {
    return this.bindings.get(nodeId);
  }

  getAllBindings(): SceneBinding[] {
    return Array.from(this.bindings.values());
  }

  private storeInitialValues(nodeId: string, object3D: THREE.Object3D): void {
    const values = new Map<string, any>();

    // Position
    values.set('position', object3D.position.clone());
    
    // Rotation
    values.set('rotation', object3D.rotation.clone());
    
    // Scale
    values.set('scale', object3D.scale.clone());

    // Light properties
    if (object3D instanceof THREE.Light) {
      values.set('lightPower', object3D.intensity);
      values.set('lightColor', object3D.color.clone());
      
      if (object3D instanceof THREE.SpotLight) {
        values.set('beamAngle', object3D.angle);
      }
    }

    // Camera properties
    if (object3D instanceof THREE.PerspectiveCamera) {
      values.set('focalLength', object3D.getFocalLength());
      values.set('aperture', object3D.userData.aperture || 2.8);
      values.set('focusDistance', object3D.userData.focusDistance || 5);
      values.set('iso', object3D.userData.iso || 100);
      values.set('shutterSpeed', object3D.userData.shutterSpeed || 1/125);
    }

    this.initialValues.set(nodeId, values);
  }

  resetToInitialValues(nodeId?: string): void {
    const nodeIds = nodeId ? [nodeId] : Array.from(this.initialValues.keys());

    for (const id of nodeIds) {
      const binding = this.bindings.get(id);
      const values = this.initialValues.get(id);

      if (binding && values) {
        const obj = binding.object3D;

        // Position
        const pos = values.get('position');
        if (pos) obj.position.copy(pos);

        // Rotation
        const rot = values.get('rotation');
        if (rot) obj.rotation.copy(rot);

        // Scale
        const scale = values.get('scale');
        if (scale) obj.scale.copy(scale);

        // Light
        if (obj instanceof THREE.Light) {
          const power = values.get('lightPower');
          if (power !== undefined) obj.intensity = power;

          const color = values.get('lightColor');
          if (color) obj.color.copy(color);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Track Management
  // -------------------------------------------------------------------------

  setTracks(tracks: AnimationTrack[]): void {
    this.tracks = tracks;
    this.updateDuration();
  }

  addTrack(track: AnimationTrack): void {
    this.tracks.push(track);
    this.updateDuration();
  }

  removeTrack(trackId: string): void {
    this.tracks = this.tracks.filter((t) => t.id !== trackId);
    this.updateDuration();
  }

  getTracks(): AnimationTrack[] {
    return this.tracks;
  }

  private updateDuration(): void {
    let maxTime = 0;
    for (const track of this.tracks) {
      for (const kf of track.keyframes) {
        if (kf.time > maxTime) maxTime = kf.time;
      }
    }
    this.state.duration = maxTime;
  }

  // -------------------------------------------------------------------------
  // Playback Control
  // -------------------------------------------------------------------------

  play(): void {
    if (this.state.isPlaying && !this.state.isPaused) return;

    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.lastTimestamp = performance.now();

    this.startAnimationLoop();
    this.notifyStateChange();
  }

  pause(): void {
    this.state.isPaused = true;
    this.stopAnimationLoop();
    this.notifyStateChange();
  }

  stop(): void {
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentTime = 0;
    this.stopAnimationLoop();
    this.resetToInitialValues();
    this.notifyStateChange();
  }

  seek(time: number): void {
    this.state.currentTime = Math.max(0, Math.min(time, this.state.duration));
    this.updateScene(this.state.currentTime);
    this.notifyStateChange();
  }

  setSpeed(speed: number): void {
    this.state.speed = speed;
    this.notifyStateChange();
  }

  setLoop(loop: boolean): void {
    this.state.loop = loop;
    this.notifyStateChange();
  }

  getState(): AnimationState {
    return { ...this.state };
  }

  // -------------------------------------------------------------------------
  // Animation Loop
  // -------------------------------------------------------------------------

  private startAnimationLoop(): void {
    if (this.animationFrameId !== null) return;

    const loop = (timestamp: number) => {
      if (!this.state.isPlaying || this.state.isPaused) {
        this.animationFrameId = null;
        return;
      }

      const delta = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      // Update time
      this.state.currentTime += delta * this.state.speed;

      // Handle loop or end
      if (this.state.currentTime >= this.state.duration) {
        if (this.state.loop) {
          this.state.currentTime = this.state.currentTime % this.state.duration;
        } else {
          this.state.currentTime = this.state.duration;
          this.state.isPlaying = false;
          this.notifyStateChange();
          return;
        }
      }

      // Update scene
      this.updateScene(this.state.currentTime);

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // -------------------------------------------------------------------------
  // Scene Update
  // -------------------------------------------------------------------------

  updateScene(time: number): void {
    const updates: PropertyUpdate[] = [];

    for (const track of this.tracks) {
      if (!track.enabled) continue;

      const binding = this.bindings.get(track.nodeId);
      if (!binding) continue;

      // Get interpolated value at current time
      const value = this.evaluateTrack(track, time);
      if (value === undefined) continue;

      // Apply value to object
      const previousValue = this.applyValueToObject(binding, track.type, value);

      updates.push({
        nodeId: track.nodeId,
        propertyPath: track.propertyPath,
        value,
        previousValue,
      });
    }

    if (updates.length > 0) {
      this.notifyUpdates(updates);
    }
  }

  private evaluateTrack(track: AnimationTrack, time: number): any {
    const keyframes = track.keyframes;
    if (keyframes.length === 0) return undefined;

    // Before first keyframe
    if (time <= keyframes[0].time) {
      return keyframes[0].value;
    }

    // After last keyframe
    if (time >= keyframes[keyframes.length - 1].time) {
      return keyframes[keyframes.length - 1].value;
    }

    // Find surrounding keyframes
    let prevKf: Keyframe | null = null;
    let nextKf: Keyframe | null = null;

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (time >= keyframes[i].time && time < keyframes[i + 1].time) {
        prevKf = keyframes[i];
        nextKf = keyframes[i + 1];
        break;
      }
    }

    if (!prevKf || !nextKf) return undefined;

    // Calculate t
    const segmentDuration = nextKf.time - prevKf.time;
    const localTime = time - prevKf.time;
    const linearT = segmentDuration > 0 ? localTime / segmentDuration : 0;

    // Apply easing
    const easedT = applyEasing(linearT, prevKf.easing);

    // Interpolate
    return interpolateValue(prevKf.value, nextKf.value, easedT, track.type);
  }

  private applyValueToObject(
    binding: SceneBinding,
    trackType: string,
    value: any
  ): any {
    const obj = binding.object3D;
    let previousValue: any;

    switch (trackType) {
      case 'position': {
        previousValue = obj.position.clone();
        if (value instanceof THREE.Vector3) {
          obj.position.copy(value);
        } else if (value && typeof value === 'object') {
          obj.position.set(value.x, value.y, value.z);
        }
        break;
      }

      case 'rotation': {
        previousValue = obj.rotation.clone();
        if (value instanceof THREE.Euler) {
          obj.rotation.copy(value);
        } else if (value instanceof THREE.Quaternion) {
          obj.rotation.setFromQuaternion(value);
        } else if (value && typeof value === 'object') {
          obj.rotation.set(value.x, value.y, value.z, value.order || 'XYZ');
        }
        break;
      }

      case 'scale': {
        previousValue = obj.scale.clone();
        if (value instanceof THREE.Vector3) {
          obj.scale.copy(value);
        } else if (typeof value === 'number') {
          obj.scale.setScalar(value);
        } else if (value && typeof value === 'object') {
          obj.scale.set(value.x, value.y, value.z);
        }
        break;
      }

      case 'lightPower': {
        if (binding.light) {
          previousValue = binding.light.intensity;
          binding.light.intensity = typeof value === 'number' ? value : 1;
        }
        break;
      }

      case 'lightColor': {
        if (binding.light) {
          previousValue = binding.light.color.clone();
          if (value instanceof THREE.Color) {
            binding.light.color.copy(value);
          } else if (typeof value === 'string') {
            binding.light.color.set(value);
          }
        }
        break;
      }

      case 'colorTemperature': {
        if (binding.light) {
          previousValue = binding.userData?.colorTemperature;
          // Convert Kelvin to RGB
          const kelvin = typeof value === 'number' ? value : 5600;
          const color = this.kelvinToRGB(kelvin);
          binding.light.color.copy(color);
          if (binding.userData) {
            binding.userData.colorTemperature = kelvin;
          }
        }
        break;
      }

      case 'beamAngle': {
        if (binding.light instanceof THREE.SpotLight) {
          previousValue = binding.light.angle;
          binding.light.angle = typeof value === 'number' ? value : Math.PI / 4;
        }
        break;
      }

      case 'focalLength': {
        if (binding.camera instanceof THREE.PerspectiveCamera) {
          previousValue = binding.camera.getFocalLength();
          if (typeof value === 'number') {
            binding.camera.setFocalLength(value);
          }
        }
        break;
      }

      case 'aperture':
      case 'focusDistance':
      case 'iso':
      case 'shutterSpeed': {
        if (binding.camera) {
          previousValue = binding.camera.userData[trackType];
          binding.camera.userData[trackType] = value;
        }
        break;
      }

      case 'zoom': {
        if (binding.light instanceof THREE.SpotLight) {
          previousValue = binding.userData?.zoom;
          if (binding.userData) {
            binding.userData.zoom = value;
          }
          // Apply zoom to penumbra
          const zoomFactor = typeof value === 'number' ? value : 1;
          binding.light.penumbra = 1 - zoomFactor;
        }
        break;
      }

      case'goboRotation': {
        previousValue = binding.userData?.goboRotation;
        if (binding.userData) {
          binding.userData.goboRotation = value;
        }
        break;
      }

      default: {
        // Generic userData property
        previousValue = binding.userData?.[trackType];
        if (binding.userData) {
          binding.userData[trackType] = value;
        }
      }
    }

    return previousValue;
  }

  private kelvinToRGB(kelvin: number): THREE.Color {
    // Approximation algorithm
    const temp = kelvin / 100;
    let r: number, g: number, b: number;

    if (temp <= 66) {
      r = 255;
      g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661));
    } else {
      r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
      g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
    }

    if (temp >= 66) {
      b = 255;
    } else if (temp <= 19) {
      b = 0;
    } else {
      b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
    }

    return new THREE.Color(r / 255, g / 255, b / 255);
  }

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  private notifyUpdates(updates: PropertyUpdate[]): void {
    this.updateCallbacks.forEach((cb) => cb(updates));
  }

  private notifyStateChange(): void {
    this.stateCallbacks.forEach((cb) => cb({ ...this.state }));
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  dispose(): void {
    this.stopAnimationLoop();
    this.bindings.clear();
    this.tracks = [];
    this.updateCallbacks.clear();
    this.stateCallbacks.clear();
    this.initialValues.clear();
  }
}

// Export singleton
export const animationStateManager = new AnimationStateManager();

export default animationStateManager;

