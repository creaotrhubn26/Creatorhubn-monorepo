/**
 * VideoExportService - Export animations to MP4/WebM video
 * 
 * Features:
 * - Frame-by-frame rendering
 * - Multiple format support (WebM, MP4 via MediaRecorder)
 * - Resolution presets
 * - Progress tracking
 * - Audio track support (placeholder)
 */

import * as THREE from 'three';
import { logger } from '../services/logger';

const log = logger.module('VideoExport');

// ============================================================================
// Types
// ============================================================================

export interface VideoExportConfig {
  format: 'webm' | 'mp4';
  width: number;
  height: number;
  fps: number;
  bitrate: number;        // in bits per second
  duration: number;       // in seconds
  quality: 'low' | 'medium' | 'high' | 'ultra';
  includeAudio?: boolean;
  audioTrack?: MediaStreamTrack;
}

export interface ExportProgress {
  currentFrame: number;
  totalFrames: number;
  percentage: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  status: 'preparing' | 'rendering' | 'encoding' | 'finalizing' | 'complete' | 'error';
  error?: string;
}

export interface ExportResult {
  success: boolean;
  blob?: Blob;
  url?: string;
  filename?: string;
  duration?: number;
  fileSize?: number;
  error?: string;
}

export type ProgressCallback = (progress: ExportProgress) => void;
export type FrameRenderCallback = (time: number, frameIndex: number) => void;

// ============================================================================
// Resolution Presets
// ============================================================================

export const RESOLUTION_PRESETS = {
  '480p': { width: 854, height: 480 }, '720p': { width: 1280, height: 720 }, '1080p': { width: 1920, height: 1080 }, '1440p': { width: 2560, height: 1440 }, '4K': { width: 3840, height: 2160 }, 'Instagram': { width: 1080, height: 1080 }, 'InstagramStory': { width: 1080, height: 1920 }, 'TikTok': { width: 1080, height: 1920 }, 'YouTube': { width: 1920, height: 1080 }, 'YouTubeShorts': { width: 1080, height: 1920 },
} as const;

export const QUALITY_PRESETS = {
  low: { bitrate: 2_500_000, description: '2.5 Mbps - Small file size' },
  medium: { bitrate: 5_000_000, description: '5 Mbps - Balanced' },
  high: { bitrate: 10_000_000, description: '10 Mbps - High quality' },
  ultra: { bitrate: 20_000_000, description: '20 Mbps - Maximum quality' },
} as const;

export const FPS_PRESETS = [24, 25, 30, 50, 60] as const;

// ============================================================================
// Video Export Service
// ============================================================================

export class VideoExportService {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isExporting = false;
  private abortController: AbortController | null = null;

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  initialize(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ): void {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.canvas = renderer.domElement;
  }

  // -------------------------------------------------------------------------
  // Export Video
  // -------------------------------------------------------------------------

  async exportVideo(
    config: VideoExportConfig,
    onProgress?: ProgressCallback,
    onFrameRender?: FrameRenderCallback
  ): Promise<ExportResult> {
    if (this.isExporting) {
      return { success: false, error: 'Export already in progress' };
    }

    if (!this.renderer || !this.scene || !this.camera) {
      return { success: false, error: 'Service not initialized. Call initialize() first.' };
    }

    this.isExporting = true;
    this.abortController = new AbortController();
    this.recordedChunks = [];

    const startTime = Date.now();
    const totalFrames = Math.ceil(config.fps * config.duration);

    try {
      // Notify: preparing
      onProgress?.({
        currentFrame: 0,
        totalFrames,
        percentage: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
        status: 'preparing',
      });

      // Create offscreen canvas for rendering
      const offscreenCanvas = document.createElement('canvas,');
      offscreenCanvas.width = config.width;
      offscreenCanvas.height = config.height;

      // Create offscreen renderer
      const offscreenRenderer = new THREE.WebGLRenderer({
        canvas: offscreenCanvas,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      offscreenRenderer.setSize(config.width, config.height);
      offscreenRenderer.setPixelRatio(1);
      offscreenRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      offscreenRenderer.toneMappingExposure = 1;

      // Setup MediaRecorder
      const stream = offscreenCanvas.captureStream(config.fps);
      
      // Add audio track if provided
      if (config.includeAudio && config.audioTrack) {
        stream.addTrack(config.audioTrack);
      }

      const mimeType = config.format === 'webm' 
        ? 'video/webm;codecs=vp9'
        : 'video/mp4';

      // Check if format is supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Fallback to webm
        const fallbackMime = 'video/webm';
        if (!MediaRecorder.isTypeSupported(fallbackMime)) {
          throw new Error('No supported video format available');
        }
      }

      const actualMimeType = MediaRecorder.isTypeSupported(mimeType) 
        ? mimeType 
        : 'video/webm';

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: actualMimeType,
        videoBitsPerSecond: config.bitrate,
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      // Start recording
      this.mediaRecorder.start();

      // Notify: rendering
      onProgress?.({
        currentFrame: 0,
        totalFrames,
        percentage: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: config.duration * 2, // Rough estimate
        status: 'rendering',
      });

      // Render each frame
      const frameInterval = 1000 / config.fps;
      
      for (let frame = 0; frame < totalFrames; frame++) {
        // Check for abort
        if (this.abortController?.signal.aborted) {
          throw new Error('Export cancelled');
        }

        const time = frame / config.fps;

        // Callback to update scene state for this time
        onFrameRender?.(time, frame);

        // Render frame
        offscreenRenderer.render(this.scene!, this.camera!);

        // Update progress
        const elapsed = (Date.now() - startTime) / 1000;
        const framesRemaining = totalFrames - frame - 1;
        const timePerFrame = elapsed / (frame + 1);
        const estimatedRemaining = framesRemaining * timePerFrame;

        onProgress?.({
          currentFrame: frame + 1,
          totalFrames,
          percentage: ((frame + 1) / totalFrames) * 100,
          elapsedTime: elapsed,
          estimatedTimeRemaining: estimatedRemaining,
          status: 'rendering',
        });

        // Small delay to allow MediaRecorder to process
        await new Promise((resolve) => setTimeout(resolve, frameInterval * 0.5));
      }

      // Notify: encoding
      onProgress?.({
        currentFrame: totalFrames,
        totalFrames,
        percentage: 95,
        elapsedTime: (Date.now() - startTime) / 1000,
        estimatedTimeRemaining: 2,
        status: 'encoding',
      });

      // Stop recording and wait for data
      const blob = await new Promise<Blob>((resolve, reject) => {
        if (!this.mediaRecorder) {
          reject(new Error('MediaRecorder not initialized'));
          return;
        }

        this.mediaRecorder.onstop = () => {
          const finalBlob = new Blob(this.recordedChunks, { type: actualMimeType });
          resolve(finalBlob);
        };

        this.mediaRecorder.onerror = (e) => {
          reject(new Error(`MediaRecorder error: ${e}`));
        };

        this.mediaRecorder.stop();
      });

      // Cleanup offscreen renderer
      offscreenRenderer.dispose();

      // Create download URL
      const url = URL.createObjectURL(blob);
      const extension = actualMimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = `animation_${Date.now()}.${extension}`;

      // Notify: complete
      onProgress?.({
        currentFrame: totalFrames,
        totalFrames,
        percentage: 100,
        elapsedTime: (Date.now() - startTime) / 1000,
        estimatedTimeRemaining: 0,
        status: 'complete',
      });

      return {
        success: true,
        blob,
        url,
        filename,
        duration: config.duration,
        fileSize: blob.size,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      onProgress?.({
        currentFrame: 0,
        totalFrames,
        percentage: 0,
        elapsedTime: (Date.now() - startTime) / 1000,
        estimatedTimeRemaining: 0,
        status: 'error',
        error: errorMessage,
      });

      return { success: false, error: errorMessage };

    } finally {
      this.isExporting = false;
      this.mediaRecorder = null;
      this.abortController = null;
    }
  }

  // -------------------------------------------------------------------------
  // Cancel Export
  // -------------------------------------------------------------------------

  cancelExport(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isExporting = false;
  }

  // -------------------------------------------------------------------------
  // Download Video
  // -------------------------------------------------------------------------

  downloadVideo(result: ExportResult): void {
    if (!result.success || !result.url || !result.filename) {
      log.error('Cannot download: invalid export result');
      return;
    }

    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // -------------------------------------------------------------------------
  // Export Single Frame
  // -------------------------------------------------------------------------

  exportFrame(
    width: number,
    height: number,
    format: 'png' | 'jpeg' = 'png',
    quality: number = 0.95
  ): ExportResult {
    if (!this.renderer || !this.scene || !this.camera) {
      return { success: false, error: 'Service not initialized' };
    }

    try {
      // Create offscreen renderer
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;

      const offscreenRenderer = new THREE.WebGLRenderer({
        canvas: offscreenCanvas,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      offscreenRenderer.setSize(width, height);
      offscreenRenderer.setPixelRatio(1);
      offscreenRenderer.toneMapping = THREE.ACESFilmicToneMapping;

      // Render
      offscreenRenderer.render(this.scene, this.camera);

      // Get data URL
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = offscreenCanvas.toDataURL(mimeType, quality);

      // Convert to blob
      const byteString = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeType });

      // Cleanup
      offscreenRenderer.dispose();

      const url = URL.createObjectURL(blob);
      const filename = `frame_${Date.now()}.${format}`;

      return {
        success: true,
        blob,
        url,
        filename,
        fileSize: blob.size,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  getIsExporting(): boolean {
    return this.isExporting;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  estimateFileSize(config: VideoExportConfig): number {
    // Rough estimate: bitrate * duration / 8 (bits to bytes)
    return Math.ceil((config.bitrate * config.duration) / 8);
  }

  // -------------------------------------------------------------------------
  // Moov Atom Optimization (Fast-Start)
  // -------------------------------------------------------------------------

  /**
   * Optimize video for streaming by moving moov atom to file start
   * This enables instant playback without downloading the entire file
   * 
   * @param blob - Video blob to optimize
   * @param filename - Original filename
   * @param onProgress - Progress callback
   * @returns Optimized video result
   */
  async optimizeForStreaming(
    blob: Blob,
    filename: string,
    onProgress?: (progress: { phase: string; percent: number; message: string }) => void
  ): Promise<ExportResult> {
    try {
      log.info('Optimizing video for streaming (fast-start)...');
      
      onProgress?.({
        phase: 'uploading',
        percent: 0,
        message: 'Uploading for optimization...',
      });

      // Create FormData
      const formData = new FormData();
      formData.append('recordings', blob, filename);
      formData.append('timestamp', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
      formData.append('optimize', 'true');
      formData.append('metadata[]', JSON.stringify({
        filename,
        originalSize: blob.size,
        type: 'animation-export',
      }));

      // Upload to backend for optimization
      const response = await fetch('/api/virtual-studio/recordings/bundle', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      onProgress?.({
        phase: 'processing',
        percent: 50,
        message: 'Optimizing with fast-start (moov atom)...',
      });

      // Get optimized blob (will be a ZIP with single file)
      const zipBlob = await response.blob();

      onProgress?.({
        phase: 'complete',
        percent: 100,
        message: 'Optimization complete!',
      });

      // Create download URL
      const url = URL.createObjectURL(zipBlob);
      const optimizedFilename = filename.replace(/\.(webm|mp4)$/i, '_optimized.zip');

      log.info(`Video optimized for streaming: ${this.formatFileSize(zipBlob.size)}`);

      return {
        success: true,
        blob: zipBlob,
        url,
        filename: optimizedFilename,
        fileSize: zipBlob.size,
      };

    } catch (error) {
      log.error('Video optimization failed: ', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Export and automatically optimize for streaming
   * Combines export + fast-start optimization in one call
   */
  async exportAndOptimize(
    config: VideoExportConfig,
    onProgress?: ProgressCallback,
    onFrameRender?: FrameRenderCallback
  ): Promise<ExportResult> {
    // First, export the video
    const exportResult = await this.exportAnimation(config, onProgress, onFrameRender);
    
    if (!exportResult.success || !exportResult.blob) {
      return exportResult;
    }

    // Then optimize for streaming
    const optimizeProgress = (p: { phase: string; percent: number; message: string }) => {
      onProgress?.({
        currentFrame: config.fps * config.duration,
        totalFrames: config.fps * config.duration,
        percentage: 95 + (p.percent * 0.05), // 95-100%
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
        status: 'finalizing',
      });
    };

    const optimized = await this.optimizeForStreaming(
      exportResult.blob,
      exportResult.filename ||'animation.mp4',
      optimizeProgress
    );

    if (!optimized.success) {
      // If optimization fails, return original (still usable, just not streaming-optimized)
      log.warn('Optimization failed, returning original video');
      return exportResult;
    }

    return optimized;
  }
}

// Export singleton
export const videoExportService = new VideoExportService();

export default videoExportService;
