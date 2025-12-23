/**
 * SAM 2 Frontend Service
 * 
 * Client-side service for SAM 2 object segmentation
 * Provides unified interface for image and video segmentation
 */

import { apiRequest } from '@/lib/queryClient';

export type SAM2PromptType = 'point' | 'box' | 'auto';
export type SAM2ModelSize = 'tiny' | 'small' | 'base_plus' | 'large';

export interface SAM2PointPrompt {
  points: Array<[number, number]>; // [x, y] coordinates
}

export interface SAM2BoxPrompt {
  box: [number, number, number, number]; // [x1, y1, x2, y2]
}

export interface SAM2SegmentationResult {
  success: boolean;
  masks: Array<{
    mask: string; // Base64 encoded PNG mask
    bbox: [number, number, number, number]; // [x, y, width, height]
    confidence: number;
    area: number;
    center: [number, number];
  }>;
  image_size: [number, number]; // [width, height]
  model_size: string;
}

export interface SAM2SegmentationJob {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: SAM2SegmentationResult;
  error?: string;
}

export class SAM2Service {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/photo-editing';
  }

  /**
   * Segment objects in an image using SAM 2
   * @param imageFile - Image file to segment
   * @param prompt - Point or box prompt (optional, for auto-detection)
   * @param promptType - Type of prompt ('point','box', or 'auto')
   * @param modelSize - SAM 2 model size to use
   */
  async segmentImage(
    imageFile: File,
    prompt?: SAM2PointPrompt | SAM2BoxPrompt,
    promptType: SAM2PromptType = 'point',
    modelSize: SAM2ModelSize = 'small'
  ): Promise<SAM2SegmentationResult> {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    if (prompt) {
      formData.append('prompt', JSON.stringify(prompt));
    }
    formData.append('prompt_type', promptType);
    formData.append('model_size', modelSize);

    const response = await apiRequest(`${this.baseUrl}/sam2-segment`, {
      method: 'POST',
      body: formData,
    });

    if (!response.success || !response.job_id) {
      throw new Error(response.message || 'Failed to start segmentation');
    }

    // Poll for job completion
    return this.pollJobStatus(response.job_id);
  }

  /**
   * Poll for job status until completion
   */
  private async pollJobStatus(
    jobId: string,
    maxAttempts: number = 60,
    intervalMs: number = 2000
  ): Promise<SAM2SegmentationResult> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.getJobStatus(jobId);

      if (status.status === 'completed' && status.result) {
        return status.result;
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Segmentation failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error('Segmentation timeout - job took too long');
  }

  /**
   * Get segmentation job status
   */
  async getJobStatus(jobId: string): Promise<SAM2SegmentationJob> {
    const response = await apiRequest(`${this.baseUrl}/sam2-segment/${jobId}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to get job status');
    }

    return {
      job_id: response.job_id,
      status: response.status,
      result: response.result,
      error: response.error,
    };
  }

  /**
   * Segment image from URL
   */
  async segmentImageFromUrl(
    imageUrl: string,
    prompt?: SAM2PointPrompt | SAM2BoxPrompt,
    promptType: SAM2PromptType = 'point',
    modelSize: SAM2ModelSize ='small'
  ): Promise<SAM2SegmentationResult> {
    // Fetch image and convert to File
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], 'image.jpg', { type: blob.type });
    
    return this.segmentImage(file, prompt, promptType, modelSize);
  }

  /**
   * Create mask from segmentation result
   * Converts base64 mask to canvas-compatible format
   */
  static async createMaskFromResult(
    maskBase64: string,
    width: number,
    height: number
  ): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        resolve(imageData);
      };
      img.onerror = () => reject(new Error('Failed to load mask image'));
      img.src = `data:image/png;base64,${maskBase64}`;
    });
  }

  /**
   * Convert mask to canvas path for drawing
   */
  static maskToPath(maskImageData: ImageData): Path2D {
    const path = new Path2D();
    const data = maskImageData.data;
    const width = maskImageData.width;
    const height = maskImageData.height;

    // Find contours in mask (simplified - in production use proper contour detection)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 128) {
          // Pixel is part of mask
          path.rect(x, y, 1, 1);
        }
      }
    }

    return path;
  }
}

// Export singleton instance
export const sam2Service = new SAM2Service();
