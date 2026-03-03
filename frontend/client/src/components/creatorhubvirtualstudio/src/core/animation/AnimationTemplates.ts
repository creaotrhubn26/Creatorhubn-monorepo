/**
 * AnimationTemplates - Pre-built animation sequences combining presets
 * 
 * Features:
 * - Full animation sequences
 * - Multi-object choreography
 * - Camera + Light combinations
 * - Customizable parameters
 * - Export/Import templates
 */

import * as THREE from 'three';
import { logger } from '../services/logger';

const log = logger.module('AnimationTemplates, ');
import {
  AnimationClip,
  AnimationTrack,
  Keyframe,
  EasingName,
} from './SceneGraphAnimationEngine';
import {
  AnimationBlendingService,
  CAMERA_ANIMATION_PRESETS,
  LIGHT_ANIMATION_PRESETS,
} from './AnimationBlendingService';

// ============================================================================
// Types
// ============================================================================

export interface AnimationStep {
  time: number;           // Start time in sequence
  duration: number;       // Duration of this step
  presetId: string;       // Which preset to apply
  presetCategory: 'camera' | 'light';
  targetNodeId: string;   // Which node to animate
  parameters?: Record<string, any>;  // Override preset params
  blendMode?: 'override' | 'additive';
  weight?: number;
}

export interface AnimationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail?: string;
  totalDuration: number;
  steps: AnimationStep[];
  requiredNodes: RequiredNode[];
  tags: string[];
}

export type TemplateCategory =
  | 'cinematic'
  | 'commercial'
  | 'interview'
  | 'product'
  | 'portrait'
  | 'action'
  | 'dramatic'
  | 'ambient';

export interface RequiredNode {
  role: string;           // e.g.'mainCamera','keyLight','subject'
  type: 'camera' | 'light' | 'object';
  description: string;
}

// ============================================================================
// Template Generator
// ============================================================================

export class AnimationTemplateGenerator {
  private blendingService = new AnimationBlendingService();

  // -------------------------------------------------------------------------
  // Generate Clips from Template
  // -------------------------------------------------------------------------

  generateClipsFromTemplate(
    template: AnimationTemplate,
    nodeMapping: Record<string, string>  // role -> actual nodeId
  ): AnimationClip[] {
    const clips: AnimationClip[] = [];

    for (const step of template.steps) {
      // Find actual node ID from role
      const nodeId = nodeMapping[step.targetNodeId] || step.targetNodeId;

      // Get preset
      const presets = step.presetCategory === 'camera'
        ? CAMERA_ANIMATION_PRESETS
        : LIGHT_ANIMATION_PRESETS;
      const preset = presets[step.presetId];

      if (!preset) {
        log.warn(`Preset not found: ${step.presetId}`);
        continue;
      }

      // Generate keyframes based on preset type
      const tracks = this.generateTracksForPreset(
        preset.id,
        step.presetCategory,
        nodeId,
        step.duration,
        step.parameters || preset.parameters || {}
      );

      // Offset keyframes by step start time
      tracks.forEach((track) => {
        track.keyframes = track.keyframes.map((kf) => ({
          ...kf,
          time: kf.time + step.time,
        }));
      });

      clips.push({
        id: `clip_${template.id}_${step.time}_${step.presetId}`,
        name: `${template.name} - ${preset.name}`,
        duration: template.totalDuration,
        tracks,
        fps: 30,
        loop: false,
      });
    }

    return clips;
  }

  private generateTracksForPreset(
    presetId: string,
    category: 'camera' | 'light',
    nodeId: string,
    duration: number,
    parameters: Record<string, any>
  ): AnimationTrack[] {
    const tracks: AnimationTrack[] = [];

    if (category === 'camera') {
      switch (presetId) {
        case 'cameraShake': {
          const { position, rotation } = this.blendingService.generateCameraShakeKeyframes(
            duration,
            parameters.intensity ?? 0.1,
            parameters.frequency ?? 20,
            parameters.decay ?? 0.9
          );
          tracks.push(
            this.createTrack(nodeId, 'position', position),
            this.createTrack(nodeId, 'rotation', rotation)
          );
          break;
        }

        case 'dollyZoom': {
          const { position, focalLength } = this.blendingService.generateDollyZoomKeyframes(
            duration,
            parameters.startDistance ?? 5,
            parameters.endDistance ?? 15,
            parameters.targetSize ?? 1
          );
          tracks.push(
            this.createTrack(nodeId, 'position', position),
            this.createTrack(nodeId, 'focalLength', focalLength)
          );
          break;
        }

        case 'rackFocus': {
          const { focusDistance, aperture } = this.blendingService.generateRackFocusKeyframes(
            duration,
            parameters.nearDistance ?? 1,
            parameters.farDistance ?? 5,
            parameters.shallowAperture ?? 1.4,
            parameters.deepAperture ?? 2.8
          );
          tracks.push(
            this.createTrack(nodeId, 'focusDistance', focusDistance),
            this.createTrack(nodeId, 'aperture', aperture)
          );
          break;
        }

        case 'handheld': {
          const { position, rotation } = this.blendingService.generateHandheldKeyframes(
            duration,
            parameters.driftAmount ?? 0.05,
            parameters.rotationAmount ?? 0.02,
            parameters.breathingSpeed ?? 0.5
          );
          tracks.push(
            this.createTrack(nodeId, 'position', position, 'additive'),
            this.createTrack(nodeId, 'rotation', rotation, 'additive')
          );
          break;
        }

        case 'sliderMove': {
          const distance = parameters.distance ?? 2;
          const horizontal = parameters.direction === 'horizontal';
          tracks.push(
            this.createTrack(nodeId, 'position', [
              { time: 0, value: new THREE.Vector3(horizontal ? -distance / 2 : 0, 0), easing: 'easeInOutCubic' },
              { time: duration, value: new THREE.Vector3(horizontal ? distance / 2 : 0, 0), easing: 'easeInOutCubic' },
            ])
          );
          break;
        }

        case 'jibUp': {
          const startHeight = parameters.startHeight ?? 1;
          const endHeight = parameters.endHeight ?? 4;
          tracks.push(
            this.createTrack(nodeId, 'position', [
              { time: 0, value: new THREE.Vector3(0, startHeight, 0), easing: 'easeInOutCubic' },
              { time: duration, value: new THREE.Vector3(0, endHeight, 0), easing: 'easeInOutCubic' },
            ]),
            this.createTrack(nodeId, 'rotation', [
              { time: 0, value: new THREE.Euler(0.2, 0, 0), easing: 'easeInOutCubic' },
              { time: duration, value: new THREE.Euler(-0.2, 0, 0), easing: 'easeInOutCubic' },
            ])
          );
          break;
        }

        case 'crashZoom': {
          tracks.push(
            this.createTrack(nodeId, 'focalLength', [
              { time: 0, value: parameters.startFov ?? 60, easing: 'easeInQuart' },
              { time: duration, value: parameters.endFov ?? 20, easing: 'easeInQuart' },
            ])
          );
          break;
        }

        case 'whipPan': {
          const angle = parameters.panAngle ?? Math.PI / 2;
          tracks.push(
            this.createTrack(nodeId, 'rotation', [
              { time: 0, value: new THREE.Euler(0, 0, 0), easing: 'easeInOutQuad' },
              { time: duration, value: new THREE.Euler(0, angle, 0), easing: 'easeInOutQuad' },
            ])
          );
          break;
        }
      }
    } else {
      // Light presets
      switch (presetId) {
        case 'lightFlicker': {
          const keyframes = this.blendingService.generateFlickerKeyframes(
            duration,
            parameters.minIntensity ?? 0.2,
            parameters.maxIntensity ?? 1,
            parameters.frequency ?? 10
          );
          tracks.push(this.createTrack(nodeId, 'lightPower', keyframes));
          break;
        }

        case 'dimmerFade': {
          tracks.push(
            this.createTrack(nodeId, 'lightPower', [
              { time: 0, value: parameters.startPower ?? 1, easing: 'easeInOutCubic' },
              { time: duration, value: parameters.endPower ?? 0, easing: 'easeInOutCubic' },
            ])
          );
          break;
        }

        case 'sunriseToSunset': {
          const startK = parameters.startKelvin ?? 2000;
          const middayK = parameters.middayKelvin ?? 5600;
          const endK = parameters.endKelvin ?? 2500;
          tracks.push(
            this.createTrack(nodeId, 'colorTemperature', [
              { time: 0, value: startK, easing: 'easeInOutCubic' },
              { time: duration * 0.3, value: middayK, easing: 'easeInOutCubic' },
              { time: duration * 0.7, value: middayK, easing: 'easeInOutCubic' },
              { time: duration, value: endK, easing: 'easeInOutCubic' },
            ]),
            this.createTrack(nodeId, 'lightPower', [
              { time: 0, value: 0.3, easing: 'easeInOutCubic' },
              { time: duration * 0.3, value: 1, easing: 'easeInOutCubic' },
              { time: duration * 0.7, value: 1, easing: 'easeInOutCubic' },
              { time: duration, value: 0.4, easing: 'easeInOutCubic' },
            ])
          );
          break;
        }

        case 'pulsatingGlow': {
          const minPower = parameters.minPower ?? 0.5;
          const maxPower = parameters.maxPower ?? 1;
          const keyframes: Keyframe<number>[] = [];
          const cycles = Math.ceil(duration / 2);
          
          for (let i = 0; i <= cycles * 2; i++) {
            keyframes.push({
              time: (i / (cycles * 2)) * duration,
              value: i % 2 === 0 ? minPower : maxPower,
              easing: 'easeInOutSine',
            });
          }
          
          tracks.push(this.createTrack(nodeId, 'lightPower', keyframes));
          break;
        }

        case 'lightSweep': {
          const sweepAngle = parameters.sweepAngle ?? Math.PI;
          tracks.push(
            this.createTrack(nodeId, 'rotation', [
              { time: 0, value: new THREE.Euler(0, -sweepAngle / 2, 0), easing: 'easeInOutCubic' },
              { time: duration, value: new THREE.Euler(0, sweepAngle / 2, 0), easing: 'easeInOutCubic' },
            ])
          );
          break;
        }

        case 'thunderFlash': {
          const base = parameters.baseIntensity ?? 0.5;
          const flash = parameters.flashIntensity ?? 5;
          tracks.push(
            this.createTrack(nodeId, 'lightPower', [
              { time: 0, value: base, easing: 'step' },
              { time: 0.05, value: flash, easing: 'step' },
              { time: 0.1, value: base, easing: 'step' },
              { time: 0.15, value: flash * 0.8, easing: 'step' },
              { time: 0.2, value: base, easing: 'easeOutQuad' },
              { time: duration, value: base, easing: 'linear' },
            ])
          );
          break;
        }
      }
    }

    return tracks;
  }

  private createTrack(
    nodeId: string,
    type: string,
    keyframes: Keyframe[],
    blendMode: 'override' | 'additive' = 'override'
  ): AnimationTrack {
    return {
      id: `track_${nodeId}_${type}_${Date.now()}`,
      nodeId,
      type: type as any,
      propertyPath: type,
      keyframes,
      enabled: true,
      blendMode,
      weight: 1,
      loop: false,
      loopCount: 1,
    };
  }
}

// ============================================================================
// Pre-built Templates
// ============================================================================

export const ANIMATION_TEMPLATES: AnimationTemplate[] = [
  // -------------------------------------------------------------------------
  // CINEMATIC
  // -------------------------------------------------------------------------
  {
    id: 'cinematic_reveal',
    name: 'Cinematic Reveal',
    description: 'Dramatic product/subject reveal with jib up and lighting fade',
    category: 'cinematic',
    totalDuration: 5,
    tags: ['reveal','dramatic','product','jib'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
      { role: 'keyLight', type: 'light', description: 'Main key light' },
      { role: 'fillLight', type: 'light', description: 'Fill light' },
    ],
    steps: [
      { time: 0, duration: 5, presetId: 'jibUp', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { startHeight: 0.5, endHeight: 2 } },
      { time: 0, duration: 2, presetId: 'dimmerFade', presetCategory: 'light', targetNodeId: 'keyLight', parameters: { startPower: 0, endPower: 1 } },
      { time: 1, duration: 3, presetId: 'dimmerFade', presetCategory: 'light', targetNodeId: 'fillLight', parameters: { startPower: 0, endPower: 0.5 } },
    ],
  },

  {
    id: 'dolly_zoom_dramatic',
    name: 'Dolly Zoom Drama',
    description: 'Classic vertigo/Hitchcock dolly zoom effect',
    category: 'dramatic',
    totalDuration: 3,
    tags: ['dolly zoom','vertigo','hitchcock','dramatic'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
    ],
    steps: [
      { time: 0, duration: 3, presetId: 'dollyZoom', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { startDistance: 3, endDistance: 10, targetSize: 1.5 } },
    ],
  },

  {
    id: 'focus_pull_dialogue',
    name: 'Focus Pull (Dialogue)',
    description: 'Rack focus between two subjects in conversation',
    category: 'cinematic',
    totalDuration: 4,
    tags: ['rack focus','dialogue','conversation'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
    ],
    steps: [
      { time: 0, duration: 1.5, presetId: 'rackFocus', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { nearDistance: 2, farDistance: 4 } },
      { time: 2, duration: 1.5, presetId: 'rackFocus', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { nearDistance: 4, farDistance: 2 } },
    ],
  },

  // -------------------------------------------------------------------------
  // COMMERCIAL
  // -------------------------------------------------------------------------
  {
    id: 'product_hero_shot',
    name: 'Product Hero Shot',
    description: 'Elegant product showcase with slider and lighting',
    category: 'product',
    totalDuration: 6,
    tags: ['product','hero','slider','commercial'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
      { role: 'keyLight', type: 'light', description: 'Main key light' },
      { role: 'rimLight', type: 'light', description: 'Rim/back light' },
    ],
    steps: [
      { time: 0, duration: 6, presetId: 'sliderMove', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { distance: 1.5, direction: 'horizontal' } },
      { time: 0, duration: 2, presetId: 'dimmerFade', presetCategory: 'light', targetNodeId: 'rimLight', parameters: { startPower: 0, endPower: 1 } },
      { time: 4, duration: 2, presetId: 'dimmerFade', presetCategory: 'light', targetNodeId: 'rimLight', parameters: { startPower: 1, endPower: 0.5 } },
    ],
  },

  {
    id: 'food_glamour',
    name: 'Food Glamour Shot',
    description: 'Appetizing food reveal with close-up and steam light',
    category: 'commercial',
    totalDuration: 4,
    tags: ['food','glamour','close-up','commercial'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
      { role: 'keyLight', type: 'light', description: 'Main key light' },
      { role: 'backLight', type: 'light', description: 'Back light for steam' },
    ],
    steps: [
      { time: 0, duration: 4, presetId: 'sliderMove', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { distance: 0.5, direction: 'horizontal' } },
      { time: 0, duration: 2, presetId: 'pulsatingGlow', presetCategory: 'light', targetNodeId: 'backLight', parameters: { minPower: 0.6, maxPower: 1 } },
    ],
  },

  // -------------------------------------------------------------------------
  // INTERVIEW
  // -------------------------------------------------------------------------
  {
    id: 'interview_handheld',
    name: 'Documentary Handheld',
    description: 'Subtle handheld movement for authentic documentary feel',
    category: 'interview',
    totalDuration: 30,
    tags: ['documentary','handheld','interview','authentic'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
    ],
    steps: [
      { time: 0, duration: 30, presetId: 'handheld', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { driftAmount: 0.03, rotationAmount: 0.01, breathingSpeed: 0.3 } },
    ],
  },

  {
    id: 'talking_head_reveal',
    name: 'Talking Head Reveal',
    description: 'Interview subject introduction with light and focus',
    category: 'interview',
    totalDuration: 3,
    tags: ['interview','reveal','talking head'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
      { role: 'keyLight', type: 'light', description: 'Main key light' },
    ],
    steps: [
      { time: 0, duration: 3, presetId: 'rackFocus', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { nearDistance: 5, farDistance: 2, shallowAperture: 2, deepAperture: 4 } },
      { time: 0, duration: 2, presetId: 'dimmerFade', presetCategory: 'light', targetNodeId: 'keyLight', parameters: { startPower: 0.3, endPower: 1 } },
    ],
  },

  // -------------------------------------------------------------------------
  // PORTRAIT
  // -------------------------------------------------------------------------
  {
    id: 'portrait_subtle_motion',
    name: 'Portrait Subtle Motion',
    description: 'Gentle slider with breathing for elegant portrait',
    category: 'portrait',
    totalDuration: 8,
    tags: ['portrait','subtle','slider','breathing'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
    ],
    steps: [
      { time: 0, duration: 8, presetId: 'sliderMove', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { distance: 0.3, direction: 'horizontal' } },
      { time: 0, duration: 8, presetId: 'handheld', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { driftAmount: 0.01, rotationAmount: 0.005, breathingSpeed: 0.2 }, blendMode: 'additive' },
    ],
  },

  // -------------------------------------------------------------------------
  // ACTION
  // -------------------------------------------------------------------------
  {
    id: 'action_impact',
    name: 'Action Impact',
    description: 'Camera shake with flash for impact moments',
    category: 'action',
    totalDuration: 1,
    tags: ['action','impact','shake','flash'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
      { role: 'flashLight', type: 'light', description: 'Flash/strobe light' },
    ],
    steps: [
      { time: 0, duration: 0.5, presetId: 'cameraShake', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { intensity: 0.2, frequency: 30, decay: 0.8 } },
      { time: 0, duration: 0.3, presetId: 'thunderFlash', presetCategory: 'light', targetNodeId: 'flashLight', parameters: { baseIntensity: 0.2, flashIntensity: 3 } },
    ],
  },

  {
    id: 'whip_pan_transition',
    name: 'Whip Pan Transition',
    description: 'Fast whip pan for scene transitions',
    category: 'action',
    totalDuration: 0.3,
    tags: ['whip pan','transition','fast'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
    ],
    steps: [
      { time: 0, duration: 0.3, presetId: 'whipPan', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { panAngle: Math.PI / 2 } },
    ],
  },

  {
    id: 'crash_zoom_dramatic',
    name: 'Crash Zoom',
    description: 'Dramatic fast zoom for emphasis',
    category: 'dramatic',
    totalDuration: 0.5,
    tags: ['crash zoom','zoom','dramatic','emphasis'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
    ],
    steps: [
      { time: 0, duration: 0.5, presetId: 'crashZoom', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { startFov: 50, endFov: 15 } },
    ],
  },

  // -------------------------------------------------------------------------
  // AMBIENT
  // -------------------------------------------------------------------------
  {
    id: 'day_night_cycle',
    name: 'Day to Night Cycle',
    description: 'Simulated time-lapse from sunrise to sunset',
    category: 'ambient',
    totalDuration: 60,
    tags: ['timelapse','day','night','sunset','sunrise'],
    requiredNodes: [
      { role: 'sunLight', type: 'light', description: 'Main sun/key light' },
    ],
    steps: [
      { time: 0, duration: 60, presetId: 'sunriseToSunset', presetCategory: 'light', targetNodeId: 'sunLight', parameters: { startKelvin: 2200, middayKelvin: 5600, endKelvin: 2800 } },
    ],
  },

  {
    id: 'storm_lightning',
    name: 'Storm & Lightning',
    description: 'Thunder storm effect with random lightning',
    category: 'ambient',
    totalDuration: 10,
    tags: ['storm','lightning','thunder','weather'],
    requiredNodes: [
      { role: 'ambientLight', type: 'light', description: 'Ambient/fill light' },
      { role: 'flashLight', type: 'light', description: 'Lightning flash' },
    ],
    steps: [
      { time: 0, duration: 10, presetId: 'lightFlicker', presetCategory: 'light', targetNodeId: 'ambientLight', parameters: { minIntensity: 0.1, maxIntensity: 0.3, frequency: 3 } },
      { time: 2, duration: 0.3, presetId: 'thunderFlash', presetCategory: 'light', targetNodeId: 'flashLight', parameters: { flashIntensity: 5 } },
      { time: 5.5, duration: 0.3, presetId: 'thunderFlash', presetCategory: 'light', targetNodeId: 'flashLight', parameters: { flashIntensity: 4 } },
      { time: 8, duration: 0.3, presetId: 'thunderFlash', presetCategory: 'light', targetNodeId: 'flashLight', parameters: { flashIntensity: 6 } },
    ],
  },

  {
    id: 'candlelight_flicker',
    name: 'Candlelight Ambiance',
    description: 'Warm flickering candlelight effect',
    category: 'ambient',
    totalDuration: 20,
    tags: ['candle','flicker','warm','romantic'],
    requiredNodes: [
      { role: 'candleLight', type: 'light', description: 'Candle/warm light' },
    ],
    steps: [
      { time: 0, duration: 20, presetId: 'lightFlicker', presetCategory: 'light', targetNodeId: 'candleLight', parameters: { minIntensity: 0.6, maxIntensity: 1, frequency: 8 } },
    ],
  },

  // -------------------------------------------------------------------------
  // COMPLEX SEQUENCES
  // -------------------------------------------------------------------------
  {
    id: 'full_product_sequence',
    name: 'Full Product Sequence',
    description: 'Complete product video with reveal, hero shots, and ending',
    category: 'commercial',
    totalDuration: 15,
    tags: ['product','commercial','sequence','complete'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
      { role: 'keyLight', type: 'light', description: 'Main key light' },
      { role: 'rimLight', type: 'light', description: 'Rim/back light' },
      { role: 'fillLight', type: 'light', description: 'Fill light' },
    ],
    steps: [
      // Opening: Reveal
      { time: 0, duration: 3, presetId: 'jibUp', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { startHeight: 0.2, endHeight: 1.5 } },
      { time: 0, duration: 2, presetId: 'dimmerFade', presetCategory: 'light', targetNodeId: 'keyLight', parameters: { startPower: 0, endPower: 1 } },
      
      // Hero shots: Slider
      { time: 3, duration: 6, presetId: 'sliderMove', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { distance: 2, direction: 'horizontal' } },
      { time: 3, duration: 6, presetId: 'pulsatingGlow', presetCategory: 'light', targetNodeId: 'rimLight', parameters: { minPower: 0.5, maxPower: 1 } },
      
      // Detail focus
      { time: 9, duration: 2, presetId: 'rackFocus', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { nearDistance: 2, farDistance: 0.5 } },
      
      // Ending
      { time: 11, duration: 4, presetId: 'dollyZoom', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { startDistance: 2, endDistance: 5, targetSize: 1 } },
      { time: 13, duration: 2, presetId: 'dimmerFade', presetCategory: 'light', targetNodeId: 'fillLight', parameters: { startPower: 1, endPower: 0.3 } },
    ],
  },

  {
    id: 'music_video_opener',
    name: 'Music Video Opener',
    description: 'Dynamic opener with crash zooms, whip pans, and impact',
    category: 'action',
    totalDuration: 8,
    tags: ['music video','dynamic','opener', 'fast'],
    requiredNodes: [
      { role: 'mainCamera', type: 'camera', description: 'Primary camera' },
      { role: 'strobeLight', type: 'light', description: 'Strobe/flash light' },
    ],
    steps: [
      // Beat 1: Crash zoom
      { time: 0, duration: 0.5, presetId: 'crashZoom', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { startFov: 70, endFov: 30 } },
      { time: 0, duration: 0.3, presetId: 'thunderFlash', presetCategory: 'light', targetNodeId: 'strobeLight', parameters: { flashIntensity: 4 } },
      
      // Beat 2: Whip pan
      { time: 1, duration: 0.3, presetId: 'whipPan', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { panAngle: Math.PI / 3 } },
      
      // Beat 3: Shake + strobe
      { time: 2, duration: 0.5, presetId: 'cameraShake', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { intensity: 0.15, frequency: 25 } },
      { time: 2, duration: 2, presetId: 'lightFlicker', presetCategory: 'light', targetNodeId: 'strobeLight', parameters: { minIntensity: 0, maxIntensity: 1, frequency: 15 } },
      
      // Build: Handheld
      { time: 4, duration: 4, presetId: 'handheld', presetCategory: 'camera', targetNodeId: 'mainCamera', parameters: { driftAmount: 0.08, rotationAmount: 0.04 } },
    ],
  },
];

// ============================================================================
// Template Service
// ============================================================================

export class AnimationTemplateService {
  private templates: Map<string, AnimationTemplate> = new Map();
  private customTemplates: Map<string, AnimationTemplate> = new Map();
  private generator = new AnimationTemplateGenerator();

  constructor() {
    // Load built-in templates
    ANIMATION_TEMPLATES.forEach((t) => this.templates.set(t.id, t));
  }

  // Get all templates
  getAllTemplates(): AnimationTemplate[] {
    return [...this.templates.values(), ...this.customTemplates.values()];
  }

  // Get by category
  getTemplatesByCategory(category: TemplateCategory): AnimationTemplate[] {
    return this.getAllTemplates().filter((t) => t.category === category);
  }

  // Get by tags
  getTemplatesByTags(tags: string[]): AnimationTemplate[] {
    return this.getAllTemplates().filter((t) =>
      tags.some((tag) => t.tags.includes(tag.toLowerCase()))
    );
  }

  // Search templates
  searchTemplates(query: string): AnimationTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTemplates().filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some((tag) => tag.includes(lowerQuery))
    );
  }

  // Get single template
  getTemplate(id: string): AnimationTemplate | undefined {
    return this.templates.get(id) || this.customTemplates.get(id);
  }

  // Apply template
  applyTemplate(
    templateId: string,
    nodeMapping: Record<string, string>
  ): AnimationClip[] | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    return this.generator.generateClipsFromTemplate(template, nodeMapping);
  }

  // Save custom template
  saveCustomTemplate(template: AnimationTemplate): void {
    this.customTemplates.set(template.id, template);
  }

  // Delete custom template
  deleteCustomTemplate(id: string): boolean {
    return this.customTemplates.delete(id);
  }

  // Export templates to JSON
  exportTemplates(templateIds?: string[]): string {
    const templates = templateIds
      ? templateIds.map((id) => this.getTemplate(id)).filter(Boolean)
      : this.getAllTemplates();
    return JSON.stringify(templates, null, 2);
  }

  // Import templates from JSON
  importTemplates(json: string): number {
    const templates: AnimationTemplate[] = JSON.parse(json);
    let count = 0;
    templates.forEach((t) => {
      if (t.id && t.name && t.steps) {
        this.customTemplates.set(t.id, t);
        count++;
      }
    });
    return count;
  }
}

// Export singleton
export const animationTemplateService = new AnimationTemplateService();

export default animationTemplateService;
