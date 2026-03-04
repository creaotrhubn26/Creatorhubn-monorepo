/**
 * StoryboardCaptureService - Captures frames from Virtual Studio 3D viewport
 * 
 * This service is the core of the storyboard system, capturing the current
 * 3D scene state including camera, lighting, and equipment configuration.
 */

import * as THREE from 'three';
import { logger } from '../services/logger';

const log = logger.module('StoryboardCapture');

import type {
  SceneSnapshot,
  CapturedCameraState,
  CapturedLightState,
  ShotType,
  CameraAngle} from '../../state/storyboardStore';
import {
  StoryboardFrame,
  CameraMovement,
} from '../../state/storyboardStore';

// =============================================================================
// Types
// =============================================================================

export interface CaptureOptions {
  width?: number;
  height?: number;
  quality?: number; // 0-1 for JPEG
  format?: 'png' | 'jpeg';
  includeThumbnail?: boolean;
  thumbnailWidth?: number;
}

export interface CaptureResult {
  imageUrl: string;
  thumbnailUrl: string;
  sceneSnapshot: SceneSnapshot;
}

// =============================================================================
// Service
// =============================================================================

class StoryboardCaptureService {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

  /**
   * Initialize the capture service with Three.js objects
   */
  initialize(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ): void {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    log.info('StoryboardCaptureService initialized');
  }

  /**
   * Check if the service is ready to capture
   */
  isReady(): boolean {
    return !!(this.renderer && this.scene && this.camera);
  }

  /**
   * Capture the current viewport as a storyboard frame
   */
  async capture(options: CaptureOptions = {}): Promise<CaptureResult> {
    if (!this.isReady()) {
      throw new Error('StoryboardCaptureService not initialized');
    }

    const {
      width = 1920,
      height = 1080,
      quality = 0.9,
      format = 'jpeg',
      includeThumbnail = true,
      thumbnailWidth = 320,
    } = options;

    // Create off-screen render target
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    // Store original render target
    const originalTarget = this.renderer!.getRenderTarget();
    const originalSize = new THREE.Vector2();
    this.renderer!.getSize(originalSize);

    try {
      // Render to off-screen target
      this.renderer!.setRenderTarget(renderTarget);
      this.renderer!.setSize(width, height);
      this.renderer!.render(this.scene!, this.camera!);

      // Read pixels
      const pixels = new Uint8Array(width * height * 4);
      this.renderer!.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);

      // Convert to canvas (flip Y)
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(width, height);

      // Flip Y axis (WebGL renders upside down)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = ((height - y - 1) * width + x) * 4;
          const dstIdx = (y * width + x) * 4;
          imageData.data[dstIdx] = pixels[srcIdx];
          imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
          imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
          imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Get image URL
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const imageUrl = canvas.toDataURL(mimeType, quality);

      // Generate thumbnail
      let thumbnailUrl = imageUrl;
      if (includeThumbnail) {
        const thumbHeight = Math.round((thumbnailWidth / width) * height);
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbnailWidth;
        thumbCanvas.height = thumbHeight;
        const thumbCtx = thumbCanvas.getContext('2d')!;
        thumbCtx.drawImage(canvas, 0, 0, thumbnailWidth, thumbHeight);
        thumbnailUrl = thumbCanvas.toDataURL(mimeType, 0.8);
      }

      // Capture scene state
      const sceneSnapshot = this.captureSceneState();

      return {
        imageUrl,
        thumbnailUrl,
        sceneSnapshot,
      };
    } finally {
      // Restore original render target
      this.renderer!.setRenderTarget(originalTarget);
      this.renderer!.setSize(originalSize.x, originalSize.y);
      renderTarget.dispose();
    }
  }

  /**
   * Capture the current scene state (camera, lights, equipment)
   */
  private captureSceneState(): SceneSnapshot {
    const camera = this.captureCameraState();
    const lights = this.captureLightsState();
    const { equipment, props, backdrop, hdriEnvironment } = this.captureSceneObjects();

    return {
      camera,
      lights,
      equipment,
      props,
      backdrop,
      hdriEnvironment,
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Capture camera state
   */
  private captureCameraState(): CapturedCameraState {
    const cam = this.camera!;
    
    // Get camera settings from userData if available
    const settings = cam.userData?.settings || {};
    
    return {
      position: [cam.position.x, cam.position.y, cam.position.z],
      rotation: [cam.rotation.x, cam.rotation.y, cam.rotation.z],
      fov: cam.fov,
      focalLength: settings.focalLength || this.fovToFocalLength(cam.fov),
      aperture: settings.aperture || 2.8,
      focusDistance: settings.focusDistance || 3.0,
      iso: settings.iso || 100,
      shutter: settings.shutter || 1 / 125,
    };
  }

  /**
   * Convert FOV to approximate focal length (35mm equivalent)
   */
  private fovToFocalLength(fov: number): number {
    // Formula: focalLength = sensorHeight / (2 * tan(fov/2))
    // Using 35mm full frame (24mm sensor height)
    const sensorHeight = 24;
    const radians = (fov * Math.PI) / 180;
    return Math.round(sensorHeight / (2 * Math.tan(radians / 2)));
  }

  /**
   * Capture lights state
   */
  private captureLightsState(): CapturedLightState[] {
    const lights: CapturedLightState[] = [];
    
    this.scene!.traverse((object) => {
      if (object instanceof THREE.Light) {
        const lightState: CapturedLightState = {
          id: object.uuid,
          name: object.name || this.getLightTypeName(object),
          type: this.getLightTypeName(object),
          position: [object.position.x, object.position.y, object.position.z],
          power: this.getLightPower(object),
          colorTemperature: this.colorToTemperature(object.color),
          modifier: object.userData?.modifier,
        };
        lights.push(lightState);
      }
    });
    
    return lights;
  }

  /**
   * Get light type name
   */
  private getLightTypeName(light: THREE.Light): string {
    if (light instanceof THREE.SpotLight) return 'Spot';
    if (light instanceof THREE.DirectionalLight) return 'Directional';
    if (light instanceof THREE.PointLight) return 'Point';
    if (light instanceof THREE.RectAreaLight) return 'Area';
    if (light instanceof THREE.HemisphereLight) return 'Hemisphere';
    if (light instanceof THREE.AmbientLight) return 'Ambient';
    return 'Unknown';
  }

  /**
   * Get light power in watts (approximate)
   */
  private getLightPower(light: THREE.Light): number {
    if ('intensity' in light) {
      // Rough conversion from Three.js intensity to watts
      return Math.round((light as any).intensity * 100);
    }
    return 100;
  }

  /**
   * Convert color to approximate color temperature
   */
  private colorToTemperature(color: THREE.Color): number {
    // Simplified conversion - in reality this is more complex
    const r = color.r;
    const b = color.b;
    
    if (r > b) {
      // Warm (2700K - 4000K)
      return Math.round(2700 + (1 - (r - b)) * 1300);
    } else if (b > r) {
      // Cool (5500K - 7500K)
      return Math.round(5500 + (b - r) * 2000);
    }
    // Neutral daylight
    return 5600;
  }

  /**
   * Capture scene objects (equipment, props, backdrop)
   */
  private captureSceneObjects(): {
    equipment: string[];
    props: string[];
    backdrop?: string;
    hdriEnvironment?: string;
  } {
    const equipment: string[] = [];
    const props: string[] = [];
    let backdrop: string | undefined;
    let hdriEnvironment: string | undefined;

    this.scene!.traverse((object) => {
      if (object.userData?.type === 'equipment') {
        equipment.push(object.name || object.userData.name || 'Unknown Equipment');
      } else if (object.userData?.type === 'prop') {
        props.push(object.name || object.userData.name || 'Unknown Prop');
      } else if (object.userData?.type === 'backdrop') {
        backdrop = object.name || object.userData.name || 'Backdrop';
      }
    });

    // Check for HDRI environment
    if (this.scene!.background instanceof THREE.Texture) {
      hdriEnvironment = this.scene!.userData?.hdriName || 'HDRI Environment';
    }

    return { equipment, props, backdrop, hdriEnvironment };
  }

  /**
   * Load a scene snapshot back into Virtual Studio
   */
  loadSceneSnapshot(snapshot: SceneSnapshot): void {
    if (!this.camera) {
      log.warn('Camera not available for loading scene snapshot');
      return;
    }

    // Restore camera position and rotation
    this.camera.position.set(...snapshot.camera.position);
    this.camera.rotation.set(...snapshot.camera.rotation);
    this.camera.fov = snapshot.camera.fov;
    this.camera.updateProjectionMatrix();

    // Store camera settings
    this.camera.userData.settings = {
      focalLength: snapshot.camera.focalLength,
      aperture: snapshot.camera.aperture,
      focusDistance: snapshot.camera.focusDistance,
      iso: snapshot.camera.iso,
      shutter: snapshot.camera.shutter,
    };

    // Dispatch event for other components to respond
    window.dispatchEvent(
      new CustomEvent('ch-storyboard-load-scene', {
        detail: { snapshot },
      })
    );

    log.info('Scene snapshot loaded into Virtual Studio');
  }

  /**
   * Auto-detect shot type based on camera distance and angle
   */
  detectShotType(targetDistance?: number): ShotType {
    if (!this.camera) return 'MS';

    // Calculate distance to origin (or target if provided)
    const distance = targetDistance || this.camera.position.length();

    // Rough distance-based detection
    if (distance < 0.5) return 'ECU';
    if (distance < 1) return 'CU';
    if (distance < 1.5) return 'MCU';
    if (distance < 2.5) return 'MS';
    if (distance < 4) return 'MLS';
    if (distance < 6) return 'LS';
    if (distance < 10) return 'VLS';
    return 'ELS';
  }

  /**
   * Auto-detect camera angle based on Y position relative to target
   */
  detectCameraAngle(targetHeight: number = 1.6): CameraAngle {
    if (!this.camera) return 'Eye Level';

    const camHeight = this.camera.position.y;
    const diff = camHeight - targetHeight;

    if (diff > 3) return 'Birds Eye';
    if (diff > 1) return 'High Angle';
    if (diff > 0.3) return 'High Angle';
    if (diff < -1) return 'Worms Eye';
    if (diff < -0.3) return 'Low Angle';
    
    // Check for Dutch angle
    const roll = Math.abs(this.camera.rotation.z);
    if (roll > 0.1) return 'Dutch Angle';

    return'Eye Level';
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const storyboardCaptureService = new StoryboardCaptureService();

export default storyboardCaptureService;

