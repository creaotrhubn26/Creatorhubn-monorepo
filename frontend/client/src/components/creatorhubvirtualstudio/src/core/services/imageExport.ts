/**
 * Image Export Service
 * 
 * Exports rendered 3D scene to various image formats.
 */

import * as THREE from 'three';
import { logger } from './logger';

const log = logger.module('ImageExport');

export interface ImageExportOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number; // 0-1 for jpeg/webp
  filename?: string;
  transparent?: boolean;
  antialiasing?: boolean;
  samples?: number; // MSAA samples
}

const DEFAULT_OPTIONS: ImageExportOptions = {
  width: 1920,
  height: 1080,
  format: 'png',
  quality: 0.95,
  filename: 'render',
  transparent: false,
  antialiasing: true,
  samples: 4,
};

/**
 * Export rendered scene to image file
 */
export async function exportRenderedImage(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: ImageExportOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Create offscreen canvas for high-res render
  const canvas = document.createElement('canvas');
  canvas.width = opts.width!;
  canvas.height = opts.height!;

  // Create high-quality renderer
  const exportRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: opts.antialiasing,
    alpha: opts.transparent,
    preserveDrawingBuffer: true,
  });

  exportRenderer.setSize(opts.width!, opts.height!);
  exportRenderer.setPixelRatio(1);
  exportRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  exportRenderer.toneMappingExposure = 1;
  exportRenderer.outputColorSpace = THREE.SRGBColorSpace;

  // Copy renderer settings
  if (renderer.shadowMap.enabled) {
    exportRenderer.shadowMap.enabled = true;
    exportRenderer.shadowMap.type = renderer.shadowMap.type;
  }

  // Render the scene
  exportRenderer.render(scene, camera);

  // Get image data
  const mimeType = `image/${opts.format}`;
  const dataUrl = canvas.toDataURL(mimeType, opts.quality);

  // Convert to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  // Cleanup
  exportRenderer.dispose();

  return blob;
}

/**
 * Export and download image
 */
export async function exportAndDownloadImage(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: ImageExportOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const blob = await exportRenderedImage(renderer, scene, camera, opts);
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${opts.filename}.${opts.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    log.error('Failed to export image: ', error);
    throw error;
  }
}

/**
 * Export current canvas to image (simple version)
 */
export function exportCanvasToImage(
  canvas: HTMLCanvasElement,
  options: Partial<ImageExportOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const mimeType = `image/${opts.format}`;
  return canvas.toDataURL(mimeType, opts.quality);
}

/**
 * Export viewport snapshot
 */
export async function exportViewportSnapshot(
  canvasOrRenderer: HTMLCanvasElement | THREE.WebGLRenderer,
  filename: string = 'snapshot'
): Promise<void> {
  const canvas = canvasOrRenderer instanceof THREE.WebGLRenderer
    ? canvasOrRenderer.domElement
    : canvasOrRenderer;

  const dataUrl = canvas.toDataURL('image/png');
  
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Get image data URL from renderer
 */
export function getRendererImageData(
  renderer: THREE.WebGLRenderer,
  format: 'png' | 'jpeg' | 'webp' ='png',
  quality: number = 0.95
): string {
  return renderer.domElement.toDataURL(`image/${format}`, quality);
}

export default {
  exportRenderedImage,
  exportAndDownloadImage,
  exportCanvasToImage,
  exportViewportSnapshot,
  getRendererImageData,
};
