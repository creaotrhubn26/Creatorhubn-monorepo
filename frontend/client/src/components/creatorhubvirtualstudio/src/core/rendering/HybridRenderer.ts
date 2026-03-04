/**
 * Hybrid Renderer
 * 
 * Combines realtime rasterization with path-traced high-quality preview
 * Similar to professional rendering software
 */

import type * as THREE from 'three';
import { PathTracer } from './PathTracer';
import { logger } from '../services/logger';

const log = logger.module('HybridRenderer');

export interface HybridRendererConfig {
  realtimeEnabled: boolean;
  pathTracingEnabled: boolean;
  pathTracingSamples: number;
  switchMode: 'manual' | 'auto'; // Auto switches to path tracing when idle
}

export class HybridRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private pathTracer: PathTracer;
  private config: HybridRendererConfig;
  
  private currentMode: 'realtime' | 'pathTracing' = 'realtime';
  private pathTracedTexture: THREE.Texture | null = null;
  
  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    config: Partial<HybridRendererConfig> = {}
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    this.config = {
      realtimeEnabled: true,
      pathTracingEnabled: false,
      pathTracingSamples: 128,
      switchMode: 'manual',
      ...config,
    };
    
    this.pathTracer = new PathTracer({
      enabled: this.config.pathTracingEnabled,
      samples: this.config.pathTracingSamples,
    });
    
    this.pathTracer.initialize(renderer, scene, camera);
  }
  
  /**
   * Render frame (realtime or path-traced)
   */
  async render(): Promise<void> {
    if (this.currentMode === 'realtime' && this.config.realtimeEnabled) {
      // Realtime rasterization
      this.renderer.render(this.scene, this.camera);
    } else if (this.currentMode === 'pathTracing' && this.config.pathTracingEnabled) {
      // Path-traced rendering
      const texture = await this.pathTracer.render();
      if (texture) {
        this.pathTracedTexture = texture;
        // Render texture to screen (simplified)
      }
    }
  }
  
  /**
   * Switch to path tracing mode
   */
  switchToPathTracing(): void {
    if (this.config.pathTracingEnabled) {
      this.currentMode = 'pathTracing';
      log.info('Switched to path tracing mode');
    }
  }
  
  /**
   * Switch to realtime mode
   */
  switchToRealtime(): void {
    if (this.config.realtimeEnabled) {
      this.currentMode = 'realtime';
      log.info('Switched to realtime mode');
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<HybridRendererConfig>): void {
    this.config = { ...this.config, ...config };
    this.pathTracer.updateConfig({
      enabled: this.config.pathTracingEnabled,
      samples: this.config.pathTracingSamples,
    });
  }
  
  /**
   * Get current rendering mode
   */
  getCurrentMode(): 'realtime' | 'pathTracing' {
    return this.currentMode;
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    this.pathTracer.dispose();
  }
}


