/**
 * VIRTUAL STUDIO INTEGRATION SERVICE
 *
 * Bridge layer connecting Virtual Studio to existing CreatorHub services: * - LUT Library & Engine (627 LUTs, GPU-accelerated)
 * - SVG Renderer (Resvg WASM, 40x faster)
 * - AI Vision Service (ONNX Runtime, scene analysis)
 */

import type { LUT3D } from '../../../../../services/lut-engine';
import { LUTEngine } from '../../../../../services/lut-engine';
import { EnhancedLUTEngine } from '../../../../../services/lut-engine-enhanced';
import { lutLoader } from '../../../../../services/lut-loader';
import { gpuLUTApplier } from '../../../../../services/gpu-lut-applier';
import { SVGRendererService } from '../../../../../services/svg-renderer';
import type {
  PhotoAnalysis,
  SceneClassification} from '../../../../../services/ai-vision-service';
import {
  AIVisionService
} from '../../../../../services/ai-vision-service';
import * as THREE from 'three';
import { logger } from '../core/services/logger';

const log = logger.module('Integrations, ');

// ============================================
// LUT INTEGRATION
// ============================================

export interface LUTIntegrationOptions {
  preserveSkinTones?: boolean;
  useGPU?: boolean;
  intensity?: number; // 0-1, LUT blend strength
}

export class LUTIntegration {
  private currentLUT: LUT3D | null = null;
  private currentLUTPath: string | null = null;

  /**
   * Get LUT library (627 professional LUTs)
   */
  getLUTLibrary() {
    return LUTEngine.getLUTLibrary();
  }

  /**
   * Search LUTs by query
   */
  searchLUTs(query: string) {
    return LUTEngine.searchLUTs(query);
  }

  /**
   * Load LUT from path
   */
  async loadLUT(path: string): Promise<LUT3D | null> {
    // Check if it's an enhanced LUT
    if (path.startsWith('enhanced://,')) {
      const lutType = path.replace('enhanced://,', ', ');
      let lutString = '';

      switch (lutType) {
        case 'cinematic_teal_orange':
          lutString = EnhancedLUTEngine.generateCinematicTealOrangeLUT(17);
          break;
        case 'vintage_film':
          lutString = EnhancedLUTEngine.generateVintageFilmLUT(17);
          break;
        case 'cross_process':
          lutString = EnhancedLUTEngine.generateCrossProcessLUT(17);
          break;
      }

      if (lutString) {
        this.currentLUT = LUTEngine.parseCubeFile(lutString);
        this.currentLUTPath = path;
        return this.currentLUT;
      }
    }

    // Load from file
    const lut = await lutLoader.loadLUT(path);
    if (lut) {
      this.currentLUT = lut;
      this.currentLUTPath = path;
    }
    return lut;
  }

  /**
   * Apply LUT to canvas (for preview)
   */
  applyLUTToCanvas(canvas: HTMLCanvasElement, options?: LUTIntegrationOptions): boolean {
    if (!this.currentLUT) return false;

    const opts = {
      preserveSkinTones: options?.preserveSkinTones ?? false,
      useGPU: options?.useGPU ?? gpuLUTApplier.isAvailable(),
      skinToneProtectionStrength: 0.8,
      ...options,
    };

    LUTEngine.applyLUT(canvas, this.currentLUT, opts);
    return true;
  }

  /**
   * Apply LUT to ImageData (GPU-accelerated)
   */
  applyLUTToImageData(imageData: ImageData, options?: LUTIntegrationOptions): ImageData {
    if (!this.currentLUT) return imageData;

    // Try GPU first
    if (options?.useGPU !== false && gpuLUTApplier.isAvailable()) {
      const result = gpuLUTApplier.applyLUTGPU(imageData, this.currentLUT);
      if (result) return result;
    }

    // Fallback to CPU (enhanced if skin tone protection needed)
    if (options?.preserveSkinTones) {
      return EnhancedLUTEngine.applyLUTEnhanced(imageData, this.currentLUT, {
        preserveSkinTones: true,
        gamutMapping: true,
      });
    }

    return lutLoader.applyLUTToImageData(imageData, this.currentLUT);
  }

  /**
   * Apply LUT to Three.js texture
   */
  async applyLUTToTexture(
    texture: THREE.Texture,
    options?: LUTIntegrationOptions,
  ): Promise<THREE.Texture> {
    if (!this.currentLUT) return texture;

    // Create canvas from texture
    const canvas = document.createElement('canvas');
    const image = texture.image as HTMLImageElement | HTMLCanvasElement;
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return texture;

    ctx.drawImage(image, 0, 0);

    // Apply LUT
    this.applyLUTToCanvas(canvas, options);

    // Create new texture
    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.needsUpdate = true;

    return newTexture;
  }

  /**
   * Get current LUT info
   */
  getCurrentLUT(): { lut: LUT3D | null; path: string | null } {
    return {
      lut: this.currentLUT,
      path: this.currentLUTPath,
    };
  }

  /**
   * Clear current LUT
   */
  clearLUT(): void {
    this.currentLUT = null;
    this.currentLUTPath = null;
  }

  /**
   * Check if GPU acceleration is available
   */
  isGPUAvailable(): boolean {
    return gpuLUTApplier.isAvailable();
  }

  /**
   * Get GPU info
   */
  getGPUInfo() {
    return gpuLUTApplier.getGPUInfo();
  }
}

// ============================================
// SVG RENDERER INTEGRATION
// ============================================

export interface SVGOverlayOptions {
  svg: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  opacity?: number;
}

export class SVGRendererIntegration {
  private renderer: any = null; // SVGRendererService instance

  /**
   * Initialize SVG renderer
   */
  async initialize(): Promise<void> {
    if (this.renderer) return;

    // Dynamic import to avoid circular dependencies
    const { default: SVGRenderer } = await import('../../../../../services/svg-renderer');
    this.renderer = new SVGRenderer();
    await this.renderer.initialize();
  }

  /**
   * Render SVG to data URL
   */
  async renderSVG(
    svg: string,
    options?: { width?: number; height?: number; format?: 'png' | 'webp' },
  ): Promise<{ dataUrl: string; width: number; height: number }> {
    await this.initialize();

    const result = await this.renderer.renderSVGToPNG(svg, {
      width: options?.width,
      height: options?.height,
      format: options?.format || 'png',
      cache: true,
    });

    return {
      dataUrl: result.dataUrl,
      width: result.width,
      height: result.height,
    };
  }

  /**
   * Apply SVG overlay to canvas
   */
  async applyOverlay(canvas: HTMLCanvasElement, overlayOptions: SVGOverlayOptions): Promise<void> {
    const { svg, position, width, height, opacity = 1.0 } = overlayOptions;

    // Render SVG to image
    const { dataUrl } = await this.renderSVG(svg, { width, height });

    // Load as image
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });

    // Draw on canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(img, position.x, position.y, img.width, img.height);
    ctx.restore();
  }

  /**
   * Batch render multiple SVGs
   */
  async batchRender(svgs: Array<{ id: string; svg: string; width?: number; height?: number }>) {
    await this.initialize();

    return await this.renderer.batchRender(
      svgs.map((item) => ({
        id: item.id,
        svg: item.svg,
        options: { width: item.width, height: item.height },
      })),
    );
  }
}

// ============================================
// AI VISION INTEGRATION
// ============================================

export interface AIVisionAnalysisOptions {
  useBrowser?: boolean;
  includeComposition?: boolean;
  includeQuality?: boolean;
}

export class AIVisionIntegration {
  /**
   * Initialize AI vision model
   */
  async initialize(): Promise<void> {
    await AIVisionService.initBrowserModel();
  }

  /**
   * Analyze scene from canvas
   */
  async analyzeScene(
    canvas: HTMLCanvasElement,
    options?: AIVisionAnalysisOptions,
  ): Promise<PhotoAnalysis> {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    return await AIVisionService.analyzePhoto(imageData, {
      useBrowser: options?.useBrowser ?? true,
      includeComposition: options?.includeComposition ?? true,
      includeQuality: options?.includeQuality ?? true,
    });
  }

  /**
   * Analyze scene from Three.js renderer
   */
  async analyzeSceneFromRenderer(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options?: AIVisionAnalysisOptions,
  ): Promise<PhotoAnalysis> {
    // Render to canvas
    renderer.render(scene, camera);

    // Get canvas
    const canvas = renderer.domElement;

    return await this.analyzeScene(canvas, options);
  }

  /**
   * Get lighting suggestions based on scene analysis
   */
  async getLightingSuggestions(analysis: PhotoAnalysis): Promise<string[]> {
    const suggestions: string[] = [];

    // Scene type suggestions
    if (analysis.scene.type === 'indoor' && analysis.scene.lighting === 'low') {
      suggestions.push('Add key light to brighten subject');
      suggestions.push('Consider fill light to reduce shadows');
    }

    if (analysis.scene.type === 'outdoor' && analysis.scene.lighting === 'bright') {
      suggestions.push('Use diffuser to soften harsh shadows');
      suggestions.push('Consider reflector for fill light');
    }

    // Quality suggestions
    if (analysis.quality.exposure < -0.3) {
      suggestions.push('Increase exposure by 1-2 stops');
    } else if (analysis.quality.exposure > 0.3) {
      suggestions.push('Decrease exposure by 1-2 stops');
    }

    // Composition suggestions
    if (!analysis.composition.ruleOfThirds) {
      suggestions.push('Consider rule of thirds composition');
    }

    return suggestions;
  }

  /**
   * Get LUT recommendations based on scene
   */
  getLUTRecommendations(scene: SceneClassification): string[] {
    const recommendations: string[] = [];

    // Wedding scenes
    if (scene.activity === 'ceremony') {
      recommendations.push('enhanced://cinematic_teal_orange');
      recommendations.push('/luts/natural.cube');
    }

    // Portrait scenes
    if (scene.activity === 'portrait' && scene.hasPeople) {
      recommendations.push('/luts/skin_tone.cube');
      recommendations.push('enhanced://vintage_film');
    }

    // Outdoor scenes
    if (scene.type === 'outdoor') {
      if (scene.lighting === 'sunset' || scene.lighting === 'golden-hour') {
        recommendations.push('/luts/warm.cube');
        recommendations.push('enhanced://vintage_film');
      }
    }

    // Indoor scenes
    if (scene.type === 'indoor') {
      recommendations.push('/luts/natural.cube');
      recommendations.push('enhanced://cinematic_teal_orange');
    }

    return recommendations;
  }

  /**
   * Detect poses in character models
   */
  async detectPoses(canvas: HTMLCanvasElement): Promise<{
    hasPeople: boolean;
    suggestions: string[];
  }> {
    const analysis = await this.analyzeScene(canvas);

    return {
      hasPeople: analysis.scene.hasPeople,
      suggestions: analysis.suggestions,
    };
  }
}

// ============================================
// UNIFIED INTEGRATION SERVICE
// ============================================

export class VirtualStudioIntegrationService {
  public lut: LUTIntegration;
  public svg: SVGRendererIntegration;
  public aiVision: AIVisionIntegration;

  private initialized = false;

  constructor() {
    this.lut = new LUTIntegration();
    this.svg = new SVGRendererIntegration();
    this.aiVision = new AIVisionIntegration();
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    log.info('Initializing Virtual Studio integrations...');
    const startTime = performance.now();

    try {
      // Initialize services in parallel
      await Promise.all([this.svg.initialize(), this.aiVision.initialize()]);

      this.initialized = true;
      const elapsed = performance.now() - startTime;

      log.info(`Virtual Studio integrations ready in ${elapsed.toFixed(0)}ms`, {
        services: [
          'LUT Library: 627 professional LUTs',
          `GPU Acceleration: ${this.lut.isGPUAvailable() ? 'Available' : 'Not available'}`,
          'SVG Renderer: Resvg WASM (40x faster)',
          'AI Vision: ONNX Runtime (scene analysis)',
        ],
      });
    } catch (error) {
      log.error('Failed to initialize integrations:', error);
      throw error;
    }
  }

  /**
   * Check if all services are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      lut: {
        library: this.lut.getLUTLibrary().reduce((sum, cat) => sum + cat.luts.length, 0),
        gpu: this.lut.isGPUAvailable(),
        gpuInfo: this.lut.getGPUInfo(),
      },
      svg: {
        available: true,
      },
      aiVision: {
        available: true,
      },
    };
  }
}

// Export singleton instance
export const integrationService = new VirtualStudioIntegrationService();
