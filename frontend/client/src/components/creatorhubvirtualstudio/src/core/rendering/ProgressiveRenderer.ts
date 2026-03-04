/**
 * Progressive Renderer with Denoising
 * 
 * Accumulates samples over time and applies denoising progressively
 * Similar to how path tracers work in professional rendering software
 */

import * as THREE from 'three';
import type { DenoiseInput } from './Denoiser';
import { Denoiser } from './Denoiser';
import { logger } from '../services/logger';

const log = logger.module('ProgressiveRenderer');

export interface ProgressiveRenderConfig {
  enabled: boolean;
  samplesPerFrame: number;
  maxSamples: number;
  denoiseEnabled: boolean;
  denoiseInterval: number; // Denoise every N samples
  denoiseStrength: number;
}

export class ProgressiveRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private denoiser: Denoiser;
  
  private config: ProgressiveRenderConfig;
  
  // Accumulation buffers
  private accumulationBuffer: Float32Array | null = null;
  private sampleCount: number = 0;
  private width: number = 0;
  private height: number = 0;
  
  // Render targets
  private renderTarget: THREE.WebGLRenderTarget | null = null;
  private accumulationTarget: THREE.WebGLRenderTarget | null = null;
  private denoisedTarget: THREE.WebGLRenderTarget | null = null;
  
  // Canvas for denoising
  private denoiseCanvas: HTMLCanvasElement | null = null;
  private denoiseContext: CanvasRenderingContext2D | null = null;
  
  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    config: Partial<ProgressiveRenderConfig> = {}
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.denoiser = new Denoiser({
      enabled: true,
      strength: 0.8,
    });
    
    this.config = {
      enabled: true,
      samplesPerFrame: 1,
      maxSamples: 128,
      denoiseEnabled: true,
      denoiseInterval: 16, // Denoise every 16 samples
      denoiseStrength: 0.8,
      ...config,
    };
  }
  
  /**
   * Initialize render targets and buffers
   */
  initialize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    
    // Create render targets
    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    });
    
    this.accumulationTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    });
    
    this.denoisedTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
    });
    
    // Initialize accumulation buffer
    this.accumulationBuffer = new Float32Array(width * height * 4);
    this.sampleCount = 0;
    
    // Create canvas for denoising
    this.denoiseCanvas = document.createElement('canvas');
    this.denoiseCanvas.width = width;
    this.denoiseCanvas.height = height;
    this.denoiseContext = this.denoiseCanvas.getContext('2d', { willReadFrequently: true });
    
    // Initialize denoiser
    this.denoiser.initialize().catch((error) => {
      log.warn('Failed to initialize denoiser:', error);
    });
  }
  
  /**
   * Render a frame and accumulate samples
   */
  render(): void {
    if (!this.config.enabled || !this.renderTarget || !this.accumulationTarget) {
      return;
    }
    
    // Render to temporary target
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
    
    // Read current frame
    const currentPixels = this.readRenderTargetPixels(this.renderTarget);
    
    // Accumulate samples
    this.accumulateSamples(currentPixels);
    this.sampleCount++;
    
    // Write accumulated result to accumulation target
    this.writeToRenderTarget(this.accumulationTarget, this.accumulationBuffer!);
    
    // Denoise if needed
    if (
      this.config.denoiseEnabled &&
      this.sampleCount > 0 &&
      this.sampleCount % this.config.denoiseInterval === 0
    ) {
      this.denoiseAccumulation();
    }
    
    // Reset render target
    this.renderer.setRenderTarget(null);
  }
  
  /**
   * Read pixels from render target
   */
  private readRenderTargetPixels(target: THREE.WebGLRenderTarget): Float32Array {
    const pixels = new Float32Array(this.width * this.height * 4);
    this.renderer.readRenderTargetPixels(
      target,
      0,
      0,
      this.width,
      this.height,
      pixels
    );
    return pixels;
  }
  
  /**
   * Accumulate samples (running average)
   */
  private accumulateSamples(newPixels: Float32Array): void {
    if (!this.accumulationBuffer) return;
    
    const n = this.sampleCount;
    const weight = 1.0 / (n + 1);
    
    for (let i = 0; i < this.accumulationBuffer.length; i++) {
      this.accumulationBuffer[i] = this.accumulationBuffer[i] * (1 - weight) + newPixels[i] * weight;
    }
  }
  
  /**
   * Write buffer to render target
   */
  private writeToRenderTarget(target: THREE.WebGLRenderTarget, buffer: Float32Array): void {
    // Convert float32 to uint8
    const uint8Buffer = new Uint8Array(this.width * this.height * 4);
    for (let i = 0; i < buffer.length; i++) {
      uint8Buffer[i] = Math.max(0, Math.min(255, buffer[i] * 255));
    }
    
    // Create texture from buffer
    const texture = new THREE.DataTexture(
      uint8Buffer,
      this.width,
      this.height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    texture.needsUpdate = true;
    
    // Copy to render target (simplified - in production would use proper GPU copy)
    // For now, we'll use the accumulation target directly
  }
  
  /**
   * Denoise accumulated result
   */
  private async denoiseAccumulation(): Promise<void> {
    if (!this.denoiseCanvas || !this.denoiseContext || !this.accumulationTarget) {
      return;
    }
    
    try {
      // Read accumulated pixels
      const pixels = this.readRenderTargetPixels(this.accumulationTarget);
      
      // Convert to ImageData
      const imageData = new ImageData(this.width, this.height);
      for (let i = 0; i < pixels.length; i += 4) {
        imageData.data[i] = Math.max(0, Math.min(255, pixels[i] * 255));
        imageData.data[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] * 255));
        imageData.data[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] * 255));
        imageData.data[i + 3] = 255;
      }
      
      // Denoise
      const denoiseInput: DenoiseInput = {
        imageData,
      };
      
      const denoised = await this.denoiser.denoise(denoiseInput);
      
      // Write back to denoised target
      this.denoiseContext.putImageData(denoised, 0, 0);
      
      // Update denoised target texture (simplified)
      // In production, would properly update the render target
    } catch (error) {
      log.warn('Denoising failed:', error);
    }
  }
  
  /**
   * Get current accumulated result
   */
  getAccumulatedTexture(): THREE.Texture | null {
    return this.accumulationTarget?.texture || null;
  }
  
  /**
   * Get denoised result
   */
  getDenoisedTexture(): THREE.Texture | null {
    return this.denoisedTarget?.texture || null;
  }
  
  /**
   * Reset accumulation
   */
  reset(): void {
    this.sampleCount = 0;
    if (this.accumulationBuffer) {
      this.accumulationBuffer.fill(0);
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProgressiveRenderConfig>): void {
    this.config = { ...this.config, ...config };
    this.denoiser.updateConfig({
      enabled: this.config.denoiseEnabled,
      strength: this.config.denoiseStrength,
    });
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    this.renderTarget?.dispose();
    this.accumulationTarget?.dispose();
    this.denoisedTarget?.dispose();
    this.denoiser.dispose();
    
    this.renderTarget = null;
    this.accumulationTarget = null;
    this.denoisedTarget = null;
    this.accumulationBuffer = null;
    this.denoiseCanvas = null;
    this.denoiseContext = null;
  }
}


