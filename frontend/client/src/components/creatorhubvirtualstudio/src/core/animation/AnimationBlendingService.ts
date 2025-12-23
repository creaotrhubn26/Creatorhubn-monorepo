/**
 * AnimationBlendingService - Advanced animation blending and transitions
 * 
 * Features:
 * - Crossfade between clips
 * - Additive blending
 * - Layer-based animation
 * - Transition curves
 * - Non-destructive editing
 */

import * as THREE from 'three';
import {
  AnimationClip,
  AnimationTrack,
  Keyframe,
  AnimationPlaybackState,
  EasingName,
  EASING_FUNCTIONS,
} from './SceneGraphAnimationEngine';

// ============================================================================
// Types
// ============================================================================

export type BlendMode = 'replace' | 'additive' | 'multiply' | 'screen' | 'overlay';

export interface AnimationLayer {
  id: string;
  name: string;
  clipId: string | null;
  weight: number;           // 0-1
  blendMode: BlendMode;
  enabled: boolean;
  solo: boolean;            // Solo this layer
  muted: boolean;
  mask?: string[];          // Only affect these node IDs
  order: number;            // Layer stack order
}

export interface LayerState {
  currentTime: number;
  isPlaying: boolean;
  isPaused: boolean;
  speed: number;
}

export interface CrossfadeConfig {
  fromClipId: string;
  toClipId: string;
  duration: number;
  easingFn: EasingName;
  syncTime?: boolean;       // Sync time between clips
}

export interface TransitionState {
  isTransitioning: boolean;
  fromClipId: string | null;
  toClipId: string | null;
  progress: number;
  duration: number;
}

// Camera Animation Presets
export interface CameraAnimationPreset {
  id: string;
  name: string;
  tracks: Partial<AnimationTrack>[];
  duration: number;
  parameters?: Record<string, number>;
}

// ============================================================================
// Camera Animation Presets
// ============================================================================

export const CAMERA_ANIMATION_PRESETS: Record<string, CameraAnimationPreset> = {
  cameraShake: {
    id: 'cameraShake',
    name: 'Camera Shake',
    duration: 0.5,
    parameters: {
      intensity: 0.1,
      frequency: 20,
      decay: 0.9,
    },
    tracks: [
      {
        type: 'position',
        propertyPath: 'position',
        keyframes: [], // Generated dynamically
        blendMode: 'additive',
      },
      {
        type: 'rotation',
        propertyPath: 'rotation',
        keyframes: [], // Generated dynamically
        blendMode: 'additive',
      },
    ],
  },
  
  dollyZoom: {
    id: 'dollyZoom',
    name: 'Dolly Zoom (Vertigo)',
    duration: 2,
    parameters: {
      startDistance: 5,
      endDistance: 15,
      targetSize: 1, // Keep subject same size
    },
    tracks: [
      {
        type: 'position',
        propertyPath: 'position',
        keyframes: [],
        blendMode: 'override',
      },
      {
        type: 'focalLength',
        propertyPath: 'focalLength',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  rackFocus: {
    id: 'rackFocus',
    name: 'Rack Focus',
    duration: 1,
    parameters: {
      nearDistance: 1,
      farDistance: 5,
    },
    tracks: [
      {
        type: 'focusDistance',
        propertyPath: 'focusDistance',
        keyframes: [],
        blendMode: 'override',
      },
      {
        type: 'aperture',
        propertyPath: 'aperture',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  handheld: {
    id: 'handheld',
    name: 'Handheld Movement',
    duration: 10,
    parameters: {
      driftAmount: 0.05,
      rotationAmount: 0.02,
      breathingSpeed: 0.5,
    },
    tracks: [
      {
        type: 'position',
        propertyPath: 'position',
        keyframes: [],
        blendMode: 'additive',
      },
      {
        type: 'rotation',
        propertyPath: 'rotation',
        keyframes: [],
        blendMode: 'additive',
      },
    ],
  },
  
  pullFocus: {
    id: 'pullFocus',
    name: 'Pull Focus',
    duration: 1.5,
    parameters: {
      startFocus: 2,
      endFocus: 6,
      apertureStart: 1.4,
      apertureEnd: 2.8,
    },
    tracks: [
      {
        type: 'focusDistance',
        propertyPath: 'focusDistance',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  whipPan: {
    id: 'whipPan',
    name: 'Whip Pan',
    duration: 0.3,
    parameters: {
      panAngle: Math.PI / 2, // 90 degrees
      motionBlur: 0.5,
    },
    tracks: [
      {
        type: 'rotation',
        propertyPath: 'rotation',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  crashZoom: {
    id: 'crashZoom',
    name: 'Crash Zoom',
    duration: 0.5,
    parameters: {
      startFov: 60,
      endFov: 20,
    },
    tracks: [
      {
        type: 'focalLength',
        propertyPath: 'focalLength',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  breathing: {
    id: 'breathing',
    name: 'Breathing (Subtle Focus Shift)',
    duration: 4,
    parameters: {
      focusVariation: 0.1,
      cycleSpeed: 1,
    },
    tracks: [
      {
        type: 'focusDistance',
        propertyPath: 'focusDistance',
        keyframes: [],
        blendMode: 'additive',
      },
    ],
  },
  
  dutchAngle: {
    id: 'dutchAngle',
    name: 'Dutch Angle',
    duration: 1,
    parameters: {
      rollAngle: Math.PI / 12, // 15 degrees
    },
    tracks: [
      {
        type: 'rotation',
        propertyPath: 'rotation',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  jibUp: {
    id: 'jibUp',
    name: 'Jib Up',
    duration: 3,
    parameters: {
      startHeight: 1,
      endHeight: 4,
      arcRadius: 2,
    },
    tracks: [
      {
        type: 'position',
        propertyPath: 'position',
        keyframes: [],
        blendMode: 'override',
      },
      {
        type: 'rotation',
        propertyPath: 'rotation',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  sliderMove: {
    id: 'sliderMove',
    name: 'Slider Move',
    duration: 4,
    parameters: {
      distance: 2,
      direction: 'horizontal', // or 'diagonal'
    },
    tracks: [
      {
        type: 'position',
        propertyPath: 'position',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
};

// ============================================================================
// Light Animation Presets
// ============================================================================

export const LIGHT_ANIMATION_PRESETS: Record<string, CameraAnimationPreset> = {
  lightFlicker: {
    id: 'lightFlicker',
    name: 'Light Flicker',
    duration: 1,
    parameters: {
      minIntensity: 0.2,
      maxIntensity: 1,
      frequency: 10,
    },
    tracks: [
      {
        type: 'lightPower',
        propertyPath: 'power',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  colorCycle: {
    id: 'colorCycle',
    name: 'Color Cycle',
    duration: 5,
    parameters: {
      colors: ['#ff0000','#00ff00''#0000ff'],
    },
    tracks: [
      {
        type: 'lightColor',
        propertyPath: 'color',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  sunriseToSunset: {
    id: 'sunriseToSunset',
    name: 'Sunrise to Sunset',
    duration: 30,
    parameters: {
      startKelvin: 2000,
      middayKelvin: 5600,
      endKelvin: 2500,
    },
    tracks: [
      {
        type: 'colorTemperature',
        propertyPath: 'colorTemperature',
        keyframes: [],
        blendMode: 'override',
      },
      {
        type: 'lightPower',
        propertyPath: 'power',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  thunderFlash: {
    id: 'thunderFlash',
    name: 'Thunder Flash',
    duration: 0.3,
    parameters: {
      flashIntensity: 5,
      baseIntensity: 0.5,
    },
    tracks: [
      {
        type: 'lightPower',
        propertyPath: 'power',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  pulsatingGlow: {
    id: 'pulsatingGlow',
    name: 'Pulsating Glow',
    duration: 2,
    parameters: {
      minPower: 0.5,
      maxPower: 1,
      pulseSpeed: 1,
    },
    tracks: [
      {
        type: 'lightPower',
        propertyPath: 'power',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  lightSweep: {
    id: 'lightSweep',
    name: 'Light Sweep',
    duration: 3,
    parameters: {
      sweepAngle: Math.PI,
      panSpeed: 1,
    },
    tracks: [
      {
        type: 'rotation',
        propertyPath: 'rotation',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  goboRotation: {
    id: 'goboRotation',
    name: 'Gobo Rotation',
    duration: 10,
    parameters: {
      rotationSpeed: 0.1,
      direction: 1, // 1 or -1
    },
    tracks: [
      {
        type: 'goboRotation',
        propertyPath: 'goboRotation',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
  
  dimmerFade: {
    id: 'dimmerFade',
    name: 'Dimmer Fade',
    duration: 2,
    parameters: {
      startPower: 1,
      endPower: 0,
    },
    tracks: [
      {
        type: 'lightPower',
        propertyPath: 'power',
        keyframes: [],
        blendMode: 'override',
      },
    ],
  },
};

// ============================================================================
// Animation Blending Service
// ============================================================================

export class AnimationBlendingService {
  private layers: Map<string, AnimationLayer> = new Map();
  private layerStates: Map<string, LayerState> = new Map();
  private transitions: Map<string, TransitionState> = new Map();
  private clips: Map<string, AnimationClip> = new Map();

  // -------------------------------------------------------------------------
  // Layer Management
  // -------------------------------------------------------------------------

  createLayer(name: string, order?: number): AnimationLayer {
    const id = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const layer: AnimationLayer = {
      id,
      name,
      clipId: null,
      weight: 1,
      blendMode: 'replace',
      enabled: true,
      solo: false,
      muted: false,
      order: order ?? this.layers.size,
    };

    this.layers.set(id, layer);
    this.layerStates.set(id, {
      currentTime: 0,
      isPlaying: false,
      isPaused: false,
      speed: 1,
    });

    return layer;
  }

  deleteLayer(layerId: string): void {
    this.layers.delete(layerId);
    this.layerStates.delete(layerId);
  }

  setLayerClip(layerId: string, clipId: string | null): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.clipId = clipId;
    }
  }

  setLayerWeight(layerId: string, weight: number): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.weight = Math.max(0, Math.min(1, weight));
    }
  }

  setLayerBlendMode(layerId: string, mode: BlendMode): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.blendMode = mode;
    }
  }

  setLayerMask(layerId: string, nodeIds: string[]): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.mask = nodeIds;
    }
  }

  toggleLayerSolo(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.solo = !layer.solo;
    }
  }

  toggleLayerMute(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.muted = !layer.muted;
    }
  }

  reorderLayer(layerId: string, newOrder: number): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.order = newOrder;
    }
  }

  getActiveLayers(): AnimationLayer[] {
    const layers = Array.from(this.layers.values())
      .filter((l) => l.enabled && !l.muted)
      .sort((a, b) => a.order - b.order);

    // If any layer is solo, only return solo layers
    const soloLayers = layers.filter((l) => l.solo);
    return soloLayers.length > 0 ? soloLayers : layers;
  }

  // -------------------------------------------------------------------------
  // Crossfade Transitions
  // -------------------------------------------------------------------------

  startCrossfade(config: CrossfadeConfig): void {
    const transitionId = `transition_${Date.now()}`;
    
    this.transitions.set(transitionId, {
      isTransitioning: true,
      fromClipId: config.fromClipId,
      toClipId: config.toClipId,
      progress: 0,
      duration: config.duration,
    });
  }

  updateTransition(transitionId: string, deltaTime: number): number {
    const transition = this.transitions.get(transitionId);
    if (!transition || !transition.isTransitioning) return 0;

    transition.progress = Math.min(1, transition.progress + deltaTime / transition.duration);

    if (transition.progress >= 1) {
      transition.isTransitioning = false;
    }

    return transition.progress;
  }

  cancelTransition(transitionId: string): void {
    this.transitions.delete(transitionId);
  }

  // -------------------------------------------------------------------------
  // Value Blending
  // -------------------------------------------------------------------------

  blendValues(
    values: Array<{ value: any; weight: number; mode: BlendMode }>,
    propertyType: string
  ): any {
    if (values.length === 0) return undefined;
    if (values.length === 1) return values[0].value;

    let result = values[0].value;

    for (let i = 1; i < values.length; i++) {
      const { value, weight, mode } = values[i];
      result = this.blend(result, value, weight, mode, propertyType);
    }

    return result;
  }

  private blend(
    base: any,
    incoming: any,
    weight: number,
    mode: BlendMode,
    propertyType: string
  ): any {
    // Handle numbers
    if (typeof base === 'number' && typeof incoming === 'number') {
      switch (mode) {
        case 'additive':
          return base + incoming * weight;
        case 'multiply':
          return base * (1 + (incoming - 1) * weight);
        case 'screen':
          return 1 - (1 - base) * (1 - incoming * weight);
        case 'overlay':
          return base < 0.5
            ? 2 * base * incoming * weight
            : 1 - 2 * (1 - base) * (1 - incoming * weight);
        case 'replace':
        default:
          return base * (1 - weight) + incoming * weight;
      }
    }

    // Handle Vector3
    if (base instanceof THREE.Vector3 && incoming instanceof THREE.Vector3) {
      const result = base.clone();
      switch (mode) {
        case 'additive':
          return result.addScaledVector(incoming, weight);
        case 'multiply':
          return result.multiply(new THREE.Vector3(1, 1, 1).lerp(incoming, weight));
        case 'replace':
        default:
          return result.lerp(incoming, weight);
      }
    }

    // Handle Euler/Quaternion (rotation)
    if (base instanceof THREE.Euler && incoming instanceof THREE.Euler) {
      const qBase = new THREE.Quaternion().setFromEuler(base);
      const qIncoming = new THREE.Quaternion().setFromEuler(incoming);

      switch (mode) {
        case 'additive':
          // For additive rotation, multiply quaternions
          const additive = qIncoming.clone();
          additive.slerp(new THREE.Quaternion(), 1 - weight);
          return new THREE.Euler().setFromQuaternion(qBase.multiply(additive));
        case 'replace':
        default:
          qBase.slerp(qIncoming, weight);
          return new THREE.Euler().setFromQuaternion(qBase);
      }
    }

    // Handle Color
    if (base instanceof THREE.Color && incoming instanceof THREE.Color) {
      const result = base.clone();
      switch (mode) {
        case 'additive':
          return result.add(incoming.clone().multiplyScalar(weight));
        case 'multiply':
          return result.multiply(incoming.clone().lerp(new THREE.Color(1, 1, 1), 1 - weight));
        case 'screen':
          const screen = new THREE.Color(
            1 - (1 - result.r) * (1 - incoming.r * weight),
            1 - (1 - result.g) * (1 - incoming.g * weight),
            1 - (1 - result.b) * (1 - incoming.b * weight)
          );
          return screen;
        case 'replace':
        default:
          return result.lerp(incoming, weight);
      }
    }

    // Default: simple lerp for replace, return incoming for others
    return mode === 'replace' ? incoming : base;
  }

  // -------------------------------------------------------------------------
  // Preset Generation
  // -------------------------------------------------------------------------

  generateCameraShakeKeyframes(
    duration: number,
    intensity: number,
    frequency: number,
    decay: number
  ): { position: Keyframe<THREE.Vector3>[]; rotation: Keyframe<THREE.Euler>[] } {
    const positionKeyframes: Keyframe<THREE.Vector3>[] = [];
    const rotationKeyframes: Keyframe<THREE.Euler>[] = [];

    const numKeyframes = Math.ceil(duration * frequency);

    for (let i = 0; i <= numKeyframes; i++) {
      const t = (i / numKeyframes) * duration;
      const currentDecay = Math.pow(decay, t);
      const currentIntensity = intensity * currentDecay;

      // Random offset with decay
      const posOffset = new THREE.Vector3(
        (Math.random() - 0.5) * 2 * currentIntensity,
        (Math.random() - 0.5) * 2 * currentIntensity,
        (Math.random() - 0.5) * 2 * currentIntensity * 0.5
      );

      const rotOffset = new THREE.Euler(
        (Math.random() - 0.5) * 2 * currentIntensity * 0.1,
        (Math.random() - 0.5) * 2 * currentIntensity * 0.1,
        (Math.random() - 0.5) * 2 * currentIntensity * 0.2
      );

      positionKeyframes.push({
        time: t,
        value: posOffset,
        easing: 'linear',
      });

      rotationKeyframes.push({
        time: t,
        value: rotOffset,
        easing: 'linear',
      });
    }

    return { position: positionKeyframes, rotation: rotationKeyframes };
  }

  generateDollyZoomKeyframes(
    duration: number,
    startDistance: number,
    endDistance: number,
    targetHeight: number // Height of subject in frame
  ): { position: Keyframe<THREE.Vector3>[]; focalLength: Keyframe<number>[] } {
    const positionKeyframes: Keyframe<THREE.Vector3>[] = [];
    const focalLengthKeyframes: Keyframe<number>[] = [];

    // Calculate focal lengths to maintain subject size
    // FOV = 2 * arctan(sensorHeight / (2 * focalLength))
    // For same angular size: focalLength / distance = constant
    const sensorHeight = 24; // mm (full frame)
    const startFocalLength = (startDistance * targetHeight * sensorHeight) / (2 * startDistance);
    const endFocalLength = (endDistance * targetHeight * sensorHeight) / (2 * endDistance);

    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * duration;
      const progress = i / steps;

      const distance = startDistance + (endDistance - startDistance) * progress;
      const focalLength = startFocalLength + (endFocalLength - startFocalLength) * progress;

      positionKeyframes.push({
        time: t,
        value: new THREE.Vector3(0, 0, distance),
        easing: 'easeInOutCubic',
      });

      focalLengthKeyframes.push({
        time: t,
        value: focalLength,
        easing: 'easeInOutCubic',
      });
    }

    return { position: positionKeyframes, focalLength: focalLengthKeyframes };
  }

  generateRackFocusKeyframes(
    duration: number,
    nearDistance: number,
    farDistance: number,
    shallowAperture: number = 1.4,
    deepAperture: number = 2.8
  ): { focusDistance: Keyframe<number>[]; aperture: Keyframe<number>[] } {
    return {
      focusDistance: [
        { time: 0, value: nearDistance, easing: 'easeInOutCubic' },
        { time: duration, value: farDistance, easing: 'easeInOutCubic' },
      ],
      aperture: [
        { time: 0, value: shallowAperture, easing: 'easeInOutCubic' },
        { time: duration * 0.5, value: deepAperture, easing: 'easeInOutCubic' },
        { time: duration, value: shallowAperture, easing: 'easeInOutCubic' },
      ],
    };
  }

  generateHandheldKeyframes(
    duration: number,
    driftAmount: number,
    rotationAmount: number,
    breathingSpeed: number
  ): { position: Keyframe<THREE.Vector3>[]; rotation: Keyframe<THREE.Euler>[] } {
    const positionKeyframes: Keyframe<THREE.Vector3>[] = [];
    const rotationKeyframes: Keyframe<THREE.Euler>[] = [];

    // Use perlin-like noise for natural movement
    const numKeyframes = Math.ceil(duration * 10); // 10 keyframes per second

    for (let i = 0; i <= numKeyframes; i++) {
      const t = (i / numKeyframes) * duration;
      
      // Combine multiple sine waves for organic movement
      const posX = driftAmount * (
        Math.sin(t * 0.5) * 0.3 +
        Math.sin(t * 1.3) * 0.2 +
        Math.sin(t * 2.7) * 0.1
      );
      const posY = driftAmount * (
        Math.sin(t * breathingSpeed) * 0.5 + // Breathing
        Math.sin(t * 0.7) * 0.2
      );
      const posZ = driftAmount * Math.sin(t * 0.3) * 0.1;

      const rotX = rotationAmount * Math.sin(t * 0.8) * 0.5;
      const rotY = rotationAmount * Math.sin(t * 0.6) * 0.3;
      const rotZ = rotationAmount * Math.sin(t * 1.1) * 0.2;

      positionKeyframes.push({
        time: t,
        value: new THREE.Vector3(posX, posY, posZ),
        easing: 'linear',
      });

      rotationKeyframes.push({
        time: t,
        value: new THREE.Euler(rotX, rotY, rotZ),
        easing: 'linear',
      });
    }

    return { position: positionKeyframes, rotation: rotationKeyframes };
  }

  generateFlickerKeyframes(
    duration: number,
    minIntensity: number,
    maxIntensity: number,
    frequency: number
  ): Keyframe<number>[] {
    const keyframes: Keyframe<number>[] = [];
    const numKeyframes = Math.ceil(duration * frequency);

    for (let i = 0; i <= numKeyframes; i++) {
      const t = (i / numKeyframes) * duration;
      
      // Random intensity with bias toward max
      const random = Math.random();
      const biased = random < 0.7 ? maxIntensity : minIntensity + random * (maxIntensity - minIntensity);

      keyframes.push({
        time: t,
        value: biased,
        easing: 'linear',
      });
    }

    return keyframes;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  serialize(): string {
    return JSON.stringify({
      layers: Array.from(this.layers.entries()),
      layerStates: Array.from(this.layerStates.entries()),
    });
  }

  deserialize(json: string): void {
    const data = JSON.parse(json);
    this.layers = new Map(data.layers);
    this.layerStates = new Map(data.layerStates);
  }
}

// Export singleton
export const animationBlendingService = new AnimationBlendingService();

export default animationBlendingService;

