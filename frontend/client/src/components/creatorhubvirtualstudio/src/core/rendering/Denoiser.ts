/**
 * AI-based Denoiser
 * 
 * Uses ONNX Runtime Web to denoise path-traced renders
 * Based on OpenImageDenoise or similar denoising models
 */

import * as ort from 'onnxruntime-web';
import { logger } from '../services/logger';

const log = logger.module('Denoiser');

export interface DenoiserConfig {
  enabled: boolean;
  strength: number; // 0-1, denoising strength
  modelPath?: string; // Path to ONNX model
  executionProvider?: 'webgl' | 'wasm' | 'cpu';
}

export interface DenoiseInput {
  imageData: ImageData;
  albedo?: ImageData; // Optional albedo buffer for better denoising
  normal?: ImageData; // Optional normal buffer
}

export class Denoiser {
  private session: ort.InferenceSession | null = null;
  private loading: Promise<void> | null = null;
  private config: DenoiserConfig;
  
  constructor(config: Partial<DenoiserConfig> = {}) {
    this.config = {
      enabled: true,
      strength: 0.8,
      modelPath: '/models/denoiser.onnx', // Default model path
      executionProvider: 'webgl',
      ...config,
    };
  }
  
  /**
   * Initialize ONNX Runtime and load denoising model
   */
  async initialize(): Promise<void> {
    if (this.session) return;
    
    if (this.loading) {
      await this.loading;
      return;
    }
    
    this.loading = (async () => {
      try {
        log.info('Loading AI denoising model...');
        
        // Configure ONNX Runtime
        ort.env.wasm.numThreads = 2;
        ort.env.wasm.simd = true;
        
        // Try to load the model
        // Note: In production, you would need to host an actual ONNX denoising model
        // For now, we'll create a placeholder that can be replaced with a real model
        try {
          this.session = await ort.InferenceSession.create(this.config.modelPath!, {
            executionProviders: [this.config.executionProvider || 'webgl', 'wasm'],
          });
          
          log.info('AI denoising model loaded successfully');
        } catch (error) {
          log.warn('Could not load denoising model, using fallback:', error);
          // Fallback to simple denoising (will be implemented)
          this.session = null;
        }
      } catch (error) {
        log.error('Failed to initialize denoiser:', error);
        this.session = null;
      }
    })();
    
    await this.loading;
  }
  
  /**
   * Denoise an image using AI model
   */
  async denoise(input: DenoiseInput): Promise<ImageData> {
    if (!this.config.enabled) {
      return input.imageData;
    }
    
    await this.initialize();
    
    // If model is not available, use fallback denoising
    if (!this.session) {
      return this.fallbackDenoise(input.imageData);
    }
    
    try {
      // Prepare input tensor
      const imageTensor = this.imageDataToTensor(input.imageData);
      
      // Run inference
      const feeds: Record<string, ort.Tensor> = {
        input: imageTensor,
      };
      
      // Add optional buffers if available
      if (input.albedo) {
        feeds.albedo = this.imageDataToTensor(input.albedo);
      }
      if (input.normal) {
        feeds.normal = this.imageDataToTensor(input.normal);
      }
      
      const results = await this.session.run(feeds);
      
      // Extract output
      const outputTensor = results.output as ort.Tensor;
      const denoisedImage = this.tensorToImageData(outputTensor, input.imageData.width, input.imageData.height);
      
      // Blend with original based on strength
      return this.blendImages(input.imageData, denoisedImage, this.config.strength);
    } catch (error) {
      log.error('Denoising failed, using fallback:', error);
      return this.fallbackDenoise(input.imageData);
    }
  }
  
  /**
   * Convert ImageData to ONNX tensor
   */
  private imageDataToTensor(imageData: ImageData): ort.Tensor {
    const { width, height, data } = imageData;
    
    // Convert RGBA to RGB and normalize to [0, 1]
    const rgbData = new Float32Array(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      rgbData[i * 3] = data[i * 4] / 255.0; // R
      rgbData[i * 3 + 1] = data[i * 4 + 1] / 255.0; // G
      rgbData[i * 3 + 2] = data[i * 4 + 2] / 255.0; // B
    }
    
    return new ort.Tensor('float32', rgbData, [1, 3, height, width]);
  }
  
  /**
   * Convert ONNX tensor to ImageData
   */
  private tensorToImageData(tensor: ort.Tensor, width: number, height: number): ImageData {
    const data = tensor.data as Float32Array;
    const imageData = new ImageData(width, height);
    
    // Convert RGB to RGBA and denormalize
    for (let i = 0; i < width * height; i++) {
      imageData.data[i * 4] = Math.max(0, Math.min(255, data[i * 3] * 255)); // R
      imageData.data[i * 4 + 1] = Math.max(0, Math.min(255, data[i * 3 + 1] * 255)); // G
      imageData.data[i * 4 + 2] = Math.max(0, Math.min(255, data[i * 3 + 2] * 255)); // B
      imageData.data[i * 4 + 3] = 255; // A
    }
    
    return imageData;
  }
  
  /**
   * Blend two images based on strength
   */
  private blendImages(original: ImageData, denoised: ImageData, strength: number): ImageData {
    const blended = new ImageData(original.width, original.height);
    const t = Math.max(0, Math.min(1, strength));
    
    for (let i = 0; i < original.data.length; i++) {
      blended.data[i] = original.data[i] * (1 - t) + denoised.data[i] * t;
    }
    
    return blended;
  }
  
  /**
   * Fallback denoising using simple bilateral filter
   * Used when AI model is not available
   */
  private fallbackDenoise(imageData: ImageData): ImageData {
    // Simple box blur as fallback
    const width = imageData.width;
    const height = imageData.height;
    const output = new ImageData(width, height);
    const radius = 2; // Blur radius
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let count = 0;
        
        // Sample neighborhood
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              r += imageData.data[idx];
              g += imageData.data[idx + 1];
              b += imageData.data[idx + 2];
              a += imageData.data[idx + 3];
              count++;
            }
          }
        }
        
        const idx = (y * width + x) * 4;
        output.data[idx] = r / count;
        output.data[idx + 1] = g / count;
        output.data[idx + 2] = b / count;
        output.data[idx + 3] = a / count;
      }
    }
    
    // Blend with original based on strength
    return this.blendImages(imageData, output, this.config.strength * 0.5); // Reduce strength for fallback
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<DenoiserConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    // ONNX Runtime sessions are automatically cleaned up
    this.session = null;
    this.loading = null;
  }
}

// Export singleton instance
export const denoiser = new Denoiser();


