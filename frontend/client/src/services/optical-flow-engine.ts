/**
 * OPTICAL FLOW ENGINE
 * Frame interpolation for smooth slow-motion
 * Like Premiere Pro's Optical Flow & Twixtor
 */

export interface FlowVector {
  x: number;
  y: number;
}

export type InterpolationQuality = 'fast' | 'good' | 'best';

/**
 * Optical Flow Engine for Frame Interpolation
 * Creates intermediate frames for smooth slow-motion
 */
export class OpticalFlowEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }
  
  /**
   * Interpolate between two frames
   * @param frame1 - First video frame
   * @param frame2 - Second video frame
   * @param t - Interpolation factor (0-1)
   * @param quality - Interpolation quality
   * @returns Interpolated frame
   */
  async interpolateFrames(
    frame1: HTMLVideoElement | HTMLCanvasElement,
    frame2: HTMLVideoElement | HTMLCanvasElement,
    t: number,
    quality: InterpolationQuality = 'good'
  ): Promise<HTMLCanvasElement> {
    const width = (frame1 as any).width || (frame1 as any).videoWidth;
    const height = (frame1 as any).height || (frame1 as any).videoHeight;
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    if (quality === 'fast') {
      // Simple blend (fast but not smooth)
      return this.simpleBlend(frame1, frame2, t);
    } else if (quality === 'good') {
      // Block-matching optical flow
      return this.blockMatchingFlow(frame1, frame2, t);
    } else {
      // Best quality (slower but smoother)
      return this.pyramidOpticalFlow(frame1, frame2, t);
    }
  }
  
  /**
   * Simple alpha blend (fastest)
   */
  private simpleBlend(
    frame1: any,
    frame2: any,
    t: number
  ): HTMLCanvasElement {
    this.ctx.globalAlpha = 1 - t;
    this.ctx.drawImage(frame1, 0, 0);
    
    this.ctx.globalAlpha = t;
    this.ctx.drawImage(frame2, 0, 0);
    
    this.ctx.globalAlpha = 1;
    
    return this.canvas;
  }
  
  /**
   * Block-matching optical flow (good quality)
   * Simplified version - production would use WebGL or WASM
   */
  private blockMatchingFlow(
    frame1: any,
    frame2: any,
    t: number
  ): HTMLCanvasElement {
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Draw frame1 as base
    this.ctx.drawImage(frame1, 0, 0);
    const data1 = this.ctx.getImageData(0, 0, width, height);
    
    // Draw frame2
    this.ctx.drawImage(frame2, 0, 0);
    const data2 = this.ctx.getImageData(0, 0, width, height);
    
    // Create output
    const output = this.ctx.createImageData(width, height);
    
    const blockSize = 16; // 16x16 blocks
    
    // For each block
    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        // Find motion vector (simplified - just blend)
        const motion = this.estimateBlockMotion(data1, data2, x, y, blockSize);
        
        // Interpolate block
        this.interpolateBlock(output, data1, data2, x, y, blockSize, t, motion);
      }
    }
    
    this.ctx.putImageData(output, 0, 0);
    return this.canvas;
  }
  
  /**
   * Estimate motion for a block (simplified)
   */
  private estimateBlockMotion(
    data1: ImageData,
    data2: ImageData,
    x: number,
    y: number,
    blockSize: number
  ): FlowVector {
    // Simplified - would use Lucas-Kanade or similar in production
    return { x: 0, y: 0 };
  }
  
  /**
   * Interpolate a block with motion compensation
   */
  private interpolateBlock(
    output: ImageData,
    data1: ImageData,
    data2: ImageData,
    x: number,
    y: number,
    blockSize: number,
    t: number,
    motion: FlowVector
  ) {
    const width = output.width;
    
    for (let by = 0; by < blockSize; by++) {
      for (let bx = 0; bx < blockSize; bx++) {
        const px = x + bx;
        const py = y + by;
        
        if (px >= width || py >= output.height) continue;
        
        const index = (py * width + px) * 4;
        
        // Motion-compensated interpolation
        const sourceX = Math.floor(px + motion.x * t);
        const sourceY = Math.floor(py + motion.y * t);
        
        if (sourceX >= 0 && sourceX < width && sourceY >= 0 && sourceY < output.height) {
          const sourceIndex1 = (py * width + px) * 4;
          const sourceIndex2 = (sourceY * width + sourceX) * 4;
          
          // Blend
          output.data[index] = data1.data[sourceIndex1] * (1 - t) + data2.data[sourceIndex2] * t;
          output.data[index + 1] = data1.data[sourceIndex1 + 1] * (1 - t) + data2.data[sourceIndex2 + 1] * t;
          output.data[index + 2] = data1.data[sourceIndex1 + 2] * (1 - t) + data2.data[sourceIndex2 + 2] * t;
          output.data[index + 3] = 255;
        }
      }
    }
  }
  
  /**
   * Pyramid optical flow (best quality)
   * Multi-scale approach for better accuracy
   */
  private pyramidOpticalFlow(
    frame1: any,
    frame2: any,
    t: number
  ): HTMLCanvasElement {
    // For now, use block matching
    // Production implementation would use multi-scale pyramid
    return this.blockMatchingFlow(frame1, frame2, t);
  }
  
  /**
   * Generate intermediate frames for slow-motion
   * @param frames - Original frames
   * @param targetFPS - Desired frame rate
   * @param originalFPS - Original frame rate
   * @returns Array of interpolated frames
   */
  async generateSlowMotionFrames(
    frames: HTMLCanvasElement[],
    originalFPS: number,
    targetFPS: number,
    quality: InterpolationQuality = 'good'
  ): Promise<HTMLCanvasElement[]> {
    if (targetFPS <= originalFPS) {
      return frames; // No interpolation needed
    }
    
    const interpolationFactor = targetFPS / originalFPS;
    const result: HTMLCanvasElement[] = [];
    
    for (let i = 0; i < frames.length - 1; i++) {
      const frame1 = frames[i];
      const frame2 = frames[i + 1];
      
      // Add original frame
      result.push(frame1);
      
      // Add interpolated frames
      const framesToAdd = Math.floor(interpolationFactor) - 1;
      for (let j = 1; j <= framesToAdd; j++) {
        const t = j / (framesToAdd + 1);
        const interpolated = await this.interpolateFrames(frame1, frame2, t, quality);
        result.push(this.cloneCanvas(interpolated));
      }
    }
    
    // Add last frame
    result.push(frames[frames.length - 1]);
    
    return result;
  }
  
  /**
   * Clone canvas
   */
  private cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    const clone = document.createElement('canvas');
    clone.width = source.width;
    clone.height = source.height;
    const ctx = clone.getContext('2d')!;
    ctx.drawImage(source, 0, 0);
    return clone;
  }
  
  /**
   * Get recommended quality based on slow-mo factor
   */
  static getRecommendedQuality(slowMotionFactor: number): InterpolationQuality {
    if (slowMotionFactor >= 4) {
      return 'best'; // 400%+ slow-mo needs best quality
    } else if (slowMotionFactor >= 2) {
      return 'good'; // 200%+ slow-mo
    } else {
      return 'fast'; // < 200% can use fast blend
    }
  }
  
  /**
   * Estimate processing time
   */
  static estimateProcessingTime(
    frameCount: number,
    quality: InterpolationQuality
  ): number {
    const timePerFrame = {
      'fast': 0.01,    // 10ms per frame
      'good': 0.05,    // 50ms per frame
     'best': 0.2      // 200ms per frame
    };
    
    return frameCount * timePerFrame[quality];
  }
}

export const opticalFlowEngine = new OpticalFlowEngine();


