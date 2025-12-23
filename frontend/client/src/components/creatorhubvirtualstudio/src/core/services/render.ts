/**
 * High-Quality Render Service
 * 
 * Provides offline rendering capabilities for the Virtual Studio:
 * - High-resolution image export
 * - Anti-aliasing with MSAA/FXAA
 * - Tone mapping options
 * - HDR output support
 * - Batch rendering
 */

import * as THREE from 'three';
import { getThreeScene } from './viewports';

// Render quality presets
export type RenderQuality = 'preview' | 'standard' | 'high' | 'ultra';

export interface RenderSettings {
  width: number;
  height: number;
  quality: RenderQuality;
  samples?: number; // MSAA samples
  format?: 'png' | 'jpeg' | 'webp';
  jpegQuality?: number; // 0-1 for JPEG
  toneMapping?: THREE.ToneMapping;
  exposure?: number;
  transparent?: boolean;
  includeBackground?: boolean;
}

export interface RenderResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  renderTime: number;
}

// Quality preset configurations
const QUALITY_PRESETS: Record<RenderQuality, Partial<RenderSettings>> = {
  preview: { samples: 1, width: 1280, height: 720 },
  standard: { samples: 4, width: 1920, height: 1080 },
  high: { samples: 8, width: 3840, height: 2160 },
  ultra: { samples: 16, width: 7680, height: 4320 },
};

// Create an offscreen renderer for high-quality output
function createOffscreenRenderer(settings: RenderSettings): THREE.WebGLRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = settings.width;
  canvas.height = settings.height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: settings.transparent ?? false,
    powerPreference: 'high-performance',
  });

  renderer.setSize(settings.width, settings.height);
  renderer.setPixelRatio(1); // Use exact resolution
  
  // Set tone mapping
  renderer.toneMapping = settings.toneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = settings.exposure ?? 1.0;
  
  // Enable shadow maps
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // Color management
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  return renderer;
}

// Get camera from scene or create default
function getSceneCamera(scene: THREE.Scene): THREE.Camera {
  let camera: THREE.Camera | null = null;
  
  scene.traverse((obj) => {
    if (obj instanceof THREE.Camera && !camera) {
      camera = obj;
    }
  });

  if (!camera) {
    // Create default camera
    camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 1, 0);
  }

  return camera;
}

/**
 * Render the current scene to a high-quality image
 */
export async function renderHighQuality(
  customSettings?: Partial<RenderSettings>
): Promise<RenderResult> {
  const startTime = performance.now();

  // Get the Three.js scene
  const scene = getThreeScene();
  if (!scene) {
    throw new Error('No scene available for rendering');
  }

  // Merge settings with defaults
  const quality = customSettings?.quality || 'standard';
  const preset = QUALITY_PRESETS[quality];
  
  const settings: RenderSettings = {
    width: customSettings?.width || preset.width || 1920,
    height: customSettings?.height || preset.height || 1080,
    quality,
    samples: customSettings?.samples || preset.samples || 4,
    format: customSettings?.format || 'png',
    jpegQuality: customSettings?.jpegQuality || 0.95,
    toneMapping: customSettings?.toneMapping,
    exposure: customSettings?.exposure,
    transparent: customSettings?.transparent ?? false,
    includeBackground: customSettings?.includeBackground ?? true,
  };

  // Create offscreen renderer
  const renderer = createOffscreenRenderer(settings);

  // Get camera
  const camera = getSceneCamera(scene);
  
  // Update camera aspect ratio
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = settings.width / settings.height;
    camera.updateProjectionMatrix();
  }

  // Store original background if we need to modify it
  const originalBackground = scene.background;
  
  if (!settings.includeBackground) {
    scene.background = null;
  }

  // Render the scene
  renderer.render(scene, camera);

  // Restore background
  scene.background = originalBackground;

  // Get image data
  const canvas = renderer.domElement;
  const mimeType = settings.format === 'jpeg' ? 'image/jpeg' : 
                   settings.format === 'webp' ? 'image/webp' : 'image/png';
  const imageQuality = settings.format === 'jpeg' || settings.format === 'webp' 
                  ? settings.jpegQuality : undefined;

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create image blob'));
      },
      mimeType,
      imageQuality
    );
  });

  // Create data URL
  const dataUrl = canvas.toDataURL(mimeType, quality);

  // Clean up renderer
  renderer.dispose();

  const renderTime = performance.now() - startTime;

  return {
    blob,
    dataUrl,
    width: settings.width,
    height: settings.height,
    renderTime,
  };
}

/**
 * Render multiple frames (for animation or batch export)
 */
export async function renderBatch(
  frameCount: number,
  onFrame: (frameIndex: number) => void,
  settings?: Partial<RenderSettings>,
  onProgress?: (progress: number) => void
): Promise<RenderResult[]> {
  const results: RenderResult[] = [];

  for (let i = 0; i < frameCount; i++) {
    // Callback to update scene/camera for this frame
    onFrame(i);

    // Render frame
    const result = await renderHighQuality(settings);
    results.push(result);

    // Report progress
    if (onProgress) {
      onProgress((i + 1) / frameCount);
    }
  }

  return results;
}

/**
 * Render with specific camera settings
 */
export async function renderWithCamera(
  cameraSettings: {
    position: [number, number, number];
    target: [number, number, number];
    fov?: number;
    near?: number;
    far?: number;
  },
  renderSettings?: Partial<RenderSettings>
): Promise<RenderResult> {
  const scene = getThreeScene();
  if (!scene) {
    throw new Error('No scene available for rendering');
  }

  // Create custom camera
  const camera = new THREE.PerspectiveCamera(
    cameraSettings.fov || 50,
    (renderSettings?.width || 1920) / (renderSettings?.height || 1080),
    cameraSettings.near || 0.1,
    cameraSettings.far || 1000
  );

  camera.position.set(...cameraSettings.position);
  camera.lookAt(...cameraSettings.target);

  // Temporarily add camera to scene
  scene.add(camera);

  try {
    return await renderHighQuality(renderSettings);
  } finally {
    scene.remove(camera);
  }
}

/**
 * Download rendered image
 */
export function downloadRender(result: RenderResult, filename: string): void {
  const link = document.createElement('a');
  link.href = result.dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get render size estimate in bytes
 */
export function estimateRenderSize(settings: RenderSettings): number {
  const pixels = settings.width * settings.height;
  const bytesPerPixel = settings.transparent ? 4 : 3;
  
  // Estimate based on format compression
  const compressionRatio = settings.format === 'png' ? 0.5 :
                           settings.format === 'jpeg' ? 0.1 :
                           settings.format ==='webp' ? 0.08 : 0.5;
  
  return Math.round(pixels * bytesPerPixel * compressionRatio);
}

export default {
  renderHighQuality,
  renderBatch,
  renderWithCamera,
  downloadRender,
  estimateRenderSize,
  QUALITY_PRESETS,
};
