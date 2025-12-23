/**
 * Face Detection Background Worker
 * 
 * Automatically analyzes all video clips in the timeline for faces
 * Runs in background, processes clips in batches, stores results in clip metadata
 */

import { faceXFormerService, type FaceAnalysisResult } from '../components/creatorhubvirtualstudio/src/services/FaceXFormerService';
import { webWorkerEngine } from './web-worker-engine';

export interface FaceDetectionResult {
  clipId: string;
  hasFace: boolean;
  faceCount: number;
  confidence: number;
  analysis?: FaceAnalysisResult;
  comprehensiveAnalysis?: {
    parsing?: {
      mask: string;
      visualization?: string;
    };
    landmarks?: {
      points: Array<{ x: number; y: number }>;
      count: number;
      visualization?: string;
    };
    headpose?: {
      pitch: number;
      yaw: number;
      roll: number;
      visualization?: string;
    };
    attributes?: {
      values: number[];
      count: number;
    };
  };
  timestamp: number; // When this frame was analyzed (in seconds)
  error?: string;
  scanMetadata?: {
    totalFramesAnalyzed: number;
    framesWithFaces: number;
    faceDetectionRate: number;
    timestamps: Array<{ timestamp: number; hasFace: boolean }>;
  };
}

export interface FaceDetectionProgress {
  total: number;
  processed: number;
  current: string | null; // Current clip ID being processed
  results: FaceDetectionResult[];
  errors: Array<{ clipId: string; error: string }>;
}

export class FaceDetectionWorker {
  private isRunning = false;
  private currentBatch: string[] = [];
  private progressCallback?: (progress: FaceDetectionProgress) => void;
  private cancelRequested = false;
  
  /**
   * Extract a frame from video at specific timestamp
   * Uses video element to extract frame, then converts to File for FaceXFormer
   */
  private async extractFrameFromVideo(
    videoUrl: string,
    timestamp: number
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      // Check if we're in a browser environment
      if (typeof document === 'undefined') {
        reject(new Error('Video frame extraction requires browser environment'));
        return;
      }
      
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      // Set source
      if (videoUrl.startsWith('blob: ') || videoUrl.startsWith('http')) {
        video.src = videoUrl;
      } else {
        // Assume it's a relative path
        video.src = videoUrl;
      }
      
      const cleanup = () => {
        if (video.src && video.src.startsWith('blob:')) {
          URL.revokeObjectURL(video.src);
        }
        video.remove();
      };
      
      const handleSeeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 1920;
          canvas.height = video.videoHeight || 1080;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanup();
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            if (!blob) {
              cleanup();
              reject(new Error('Could not create blob from canvas'));
              return;
            }
            
            // Create File from blob
            const file = new File([blob], `frame_${timestamp.toFixed(2)}.jpg`, { type: 'image/jpeg' });
            cleanup();
            resolve(file);
          }, 'image/jpeg', 0.9);
        } catch (error: any) {
          cleanup();
          reject(error);
        }
      };
      
      video.addEventListener('seeked', handleSeeked, { once: true });
      
      video.addEventListener('loadedmetadata', () => {
        // Ensure video is ready before seeking
        if (video.readyState >= 2) {
          video.currentTime = Math.min(timestamp, video.duration || 0);
        } else {
          video.addEventListener('canplay', () => {
            video.currentTime = Math.min(timestamp, video.duration || 0);
          }, { once: true });
        }
      }, { once: true });
      
      video.addEventListener('error', (e) => {
        cleanup();
        reject(new Error(`Video load error: ${(e.target as HTMLVideoElement)?.error?.message || 'Unknown error'}`));
      });
      
      // Start loading
      video.load();
    });
  }
  
  /**
   * Analyze a single clip for faces
   * @param scanEntireVideo - If true, scans multiple frames throughout the video
   * @param framesPerSecond - How many frames to sample per second (default: 0.5 = 1 frame every 2 seconds)
   * @param tasks - Which FaceXFormer tasks to run: 'all','parsing','landmarks', 'headpose', 'attributes', or array of tasks
   */
  private async analyzeClip(
    clipId: string,
    videoUrl: string,
    duration: number,
    scanEntireVideo: boolean = false,
    framesPerSecond: number = 0.5,
    tasks: 'all' | 'parsing' | 'landmarks' | 'headpose' | 'attributes' | Array<'parsing' | 'landmarks' | 'headpose' | 'attributes'> = 'all'
  ): Promise<FaceDetectionResult> {
    try {
      let timestamps: number[] = [];
      
      if (scanEntireVideo && duration > 0) {
        // Scan entire video: sample frames throughout
        const frameInterval = 1 / framesPerSecond; // e.g., 0.5 fps = 1 frame every 2 seconds
        const totalFrames = Math.ceil(duration * framesPerSecond);
        
        // Generate timestamps evenly distributed across the video
        for (let i = 0; i < totalFrames; i++) {
          const timestamp = (i * frameInterval);
          if (timestamp < duration) {
            timestamps.push(timestamp);
          }
        }
        
        // Always include first and last frame
        if (timestamps[0] !== 0) timestamps.unshift(0);
        if (timestamps[timestamps.length - 1] !== duration - 0.1) {
          timestamps.push(Math.max(0, duration - 0.1));
        }
        
        // Remove duplicates and sort
        timestamps = [...new Set(timestamps)].sort((a, b) => a - b);
        
        console.log(`📹 Scanning entire video: ${timestamps.length} frames over ${duration.toFixed(2)}s (${framesPerSecond} fps sampling)`);
      } else {
        // Quick scan: just a few key frames
        timestamps = [
          duration * 0.25, // 25% through clip
          duration * 0.5,  // Middle of clip
          duration * 0.75, // 75% through clip
        ];
        
        // Always try first frame
        if (timestamps[0] !== 0) timestamps.unshift(0);
      }
      
      let bestResult: FaceAnalysisResult | null = null;
      let bestTimestamp = 0;
      let hasFace = false;
      let faceDetections: Array<{ timestamp: number; hasFace: boolean; confidence: number }> = [];
      
      // Analyze all frames
      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        try {
          const frameFile = await this.extractFrameFromVideo(videoUrl, timestamp);
          
          // Run analysis with specified tasks
          let analysis: FaceAnalysisResult;
          if (tasks === 'all') {
            analysis = await faceXFormerService.analyzeAll(frameFile);
          } else if (Array.isArray(tasks)) {
            // Run multiple specific tasks - use 'all' and filter results
            analysis = await faceXFormerService.analyzeAll(frameFile);
            // Filter results to only include requested tasks
            const filteredResults: any = {};
            if (tasks.includes('parsing')) {
              filteredResults.parsing = analysis.results.parsing;
              filteredResults.parsing_visualization = analysis.results.parsing_visualization;
            }
            if (tasks.includes('landmarks')) {
              filteredResults.landmarks = analysis.results.landmarks;
              filteredResults.landmarks_visualization = analysis.results.landmarks_visualization;
            }
            if (tasks.includes('headpose')) {
              filteredResults.headpose = analysis.results.headpose;
              filteredResults.headpose_visualization = analysis.results.headpose_visualization;
            }
            if (tasks.includes('attributes')) {
              filteredResults.attributes = analysis.results.attributes;
            }
            analysis = {
              ...analysis,
              results: { ...analysis.results, ...filteredResults },
            };
          } else {
            // Single specific task
            analysis = await faceXFormerService.analyzeFace(frameFile, tasks);
          }
          
          // Check if face was detected (landmarks or parsing mask exists)
          const detected = !!(analysis.results.landmarks?.length || analysis.results.parsing);
          const confidence = detected ? 0.9 : 0.1;
          
          faceDetections.push({ timestamp, hasFace: detected, confidence });
          
          if (detected && (!bestResult || (analysis.results.landmarks?.length || 0) > (bestResult.results.landmarks?.length || 0))) {
            bestResult = analysis;
            bestTimestamp = timestamp;
            hasFace = true;
          }
          
          if (scanEntireVideo && i % 10 === 0) {
            console.log(`  📊 Progress: ${i + 1}/${timestamps.length} frames analyzed (${((i + 1) / timestamps.length * 100).toFixed(1)}%)`);
          }
        } catch (error) {
          console.warn(`Failed to analyze frame at ${timestamp.toFixed(2)}s:`, error);
          faceDetections.push({ timestamp, hasFace: false, confidence: 0 });
          // Continue to next frame
        }
      }
      
      // Calculate overall statistics
      const framesWithFaces = faceDetections.filter(d => d.hasFace).length;
      const faceDetectionRate = faceDetections.length > 0 ? framesWithFaces / faceDetections.length : 0;
      
      // Extract comprehensive analysis data
      const comprehensiveAnalysis = bestResult ? {
        parsing: bestResult.results.parsing ? {
          mask: bestResult.results.parsing,
          visualization: bestResult.results.parsing_visualization,
        } : undefined,
        landmarks: bestResult.results.landmarks ? {
          points: bestResult.results.landmarks,
          count: bestResult.results.landmarks.length,
          visualization: bestResult.results.landmarks_visualization,
        } : undefined,
        headpose: bestResult.results.headpose ? {
          pitch: bestResult.results.headpose.pitch,
          yaw: bestResult.results.headpose.yaw,
          roll: bestResult.results.headpose.roll,
          visualization: bestResult.results.headpose_visualization,
        } : undefined,
        attributes: bestResult.results.attributes ? {
          values: bestResult.results.attributes,
          count: bestResult.results.attributes.length,
        } : undefined,
      } : undefined;
      
      return {
        clipId,
        hasFace,
        faceCount: bestResult?.results.landmarks ? 1 : 0, // Could be enhanced to detect multiple faces
        confidence: hasFace ? Math.max(0.9, faceDetectionRate) : 0.1,
        analysis: bestResult || undefined,
        comprehensiveAnalysis, // New: structured analysis data
        timestamp: bestTimestamp,
        // Add metadata about full scan
        ...(scanEntireVideo && {
          scanMetadata: {
            totalFramesAnalyzed: timestamps.length,
            framesWithFaces,
            faceDetectionRate,
            timestamps: faceDetections.map(d => ({ timestamp: d.timestamp, hasFace: d.hasFace })),
          },
        }),
      } as FaceDetectionResult;
    } catch (error: any) {
      return {
        clipId,
        hasFace: false,
        faceCount: 0,
        confidence: 0,
        timestamp: 0,
        error: error?.message || 'Unknown error',
      };
    }
  }
  
  /**
   * Process clips in batches
   */
  async processClips(
    clips: Array<{ id: string; sourceFile: string; duration: number }>,
    options: {
      batchSize?: number;
      onProgress?: (progress: FaceDetectionProgress) => void;
      sampleFrames?: number; // Number of frames to sample per clip (deprecated, use scanEntireVideo)
      scanEntireVideo?: boolean; // If true, scans entire video instead of just a few frames
      framesPerSecond?: number; // Frames per second to sample when scanning entire video (default: 0.5 = 1 frame every 2 seconds)
      tasks?: 'all' | 'parsing' | 'landmarks' | 'headpose' | 'attributes' | Array<'parsing' | 'landmarks' | 'headpose' | 'attributes'>; // Which FaceXFormer tasks to run
    } = {}
  ): Promise<FaceDetectionResult[]> {
    const { 
      batchSize = 3, 
      onProgress, 
      sampleFrames = 3,
      scanEntireVideo = false,
      framesPerSecond = 0.5, // Default: 1 frame every 2 seconds
      tasks = 'all', // Default: run all FaceXFormer tasks
    } = options;
    
    this.isRunning = true;
    this.cancelRequested = false;
    this.progressCallback = onProgress;
    
    const results: FaceDetectionResult[] = [];
    const errors: Array<{ clipId: string; error: string }> = [];
    
    // Filter to only video clips with valid source files
    const videoClips = clips.filter(
      clip => clip.sourceFile && 
      (clip.sourceFile.startsWith('http') || clip.sourceFile.startsWith('blob:') || clip.sourceFile.startsWith('/'))
    );
    
    const total = videoClips.length;
    let processed = 0;
    
    // Process in batches
    for (let i = 0; i < videoClips.length; i += batchSize) {
      if (this.cancelRequested) {
        console.log('🛑 Face detection cancelled');
        break;
      }
      
      const batch = videoClips.slice(i, i + batchSize);
      this.currentBatch = batch.map(c => c.id);
      
      // Process batch in parallel
      const batchPromises = batch.map(clip => 
        this.analyzeClip(
          clip.id, 
          clip.sourceFile, 
          clip.duration || 5,
          scanEntireVideo,
          framesPerSecond,
          tasks
        )
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.error) {
            errors.push({ clipId: batch[idx].id, error: result.value.error });
          }
        } else {
          const clipId = batch[idx].id;
          errors.push({ clipId, error: result.reason?.message || 'Unknown error' });
          results.push({
            clipId,
            hasFace: false,
            faceCount: 0,
            confidence: 0,
            timestamp: 0,
            error: result.reason?.message ||'Unknown error',
          });
        }
        processed++;
      });
      
      // Report progress
      if (onProgress) {
        onProgress({
          total,
          processed,
          current: batch[batch.length - 1]?.id || null,
          results,
          errors,
        });
      }
      
      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < videoClips.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.isRunning = false;
    this.currentBatch = [];
    
    return results;
  }
  
  /**
   * Cancel ongoing processing
   */
  cancel() {
    this.cancelRequested = true;
  }
  
  /**
   * Check if worker is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }
  
  /**
   * Get current batch being processed
   */
  get currentBatchIds(): string[] {
    return [...this.currentBatch];
  }
}

// Export singleton instance
export const faceDetectionWorker = new FaceDetectionWorker();
