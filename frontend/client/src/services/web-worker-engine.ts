/**
 * WEB WORKER ENGINE
 * Using comlink for background processing
 * Offload heavy tasks (thumbnail generation, encoding)
 */

import { wrap, expose } from 'comlink';

/**
 * Video processing worker functions
 */
export const videoWorkerFunctions = {
  /**
   * Generate thumbnail from video
   */
  async generateThumbnail(
    videoBlob: Blob,
    timestamp: number,
    width: number,
    height: number
  ): Promise<string> {
    // Create video element in worker
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoBlob);
    video.currentTime = timestamp;
    
    return new Promise((resolve, reject) => {
      video.addEventListener('seeked', () => {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d')!;
        
        ctx.drawImage(video, 0, 0, width, height);
        
        canvas.convertToBlob().then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        
        URL.revokeObjectURL(video.src);
      });
      
      video.addEventListener('error', reject);
    });
  },
  
  /**
   * Extract frames from video
   */
  async extractFrames(
    videoBlob: Blob,
    frameRate: number
  ): Promise<string[]> {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoBlob);
    
    await new Promise(resolve => {
      video.addEventListener('loadedmetadata', resolve);
    });
    
    const duration = video.duration;
    const frameInterval = 1 / frameRate;
    const frames: string[] = [];
    
    for (let time = 0; time < duration; time += frameInterval) {
      video.currentTime = time;
      
      await new Promise(resolve => {
        video.addEventListener('seeked', resolve, { once: true });
      });
      
      const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      
      const blob = await canvas.convertToBlob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      
      frames.push(dataUrl);
    }
    
    URL.revokeObjectURL(video.src);
    
    return frames;
  },
  
  /**
   * Analyze video metadata
   */
  async analyzeVideo(videoBlob: Blob): Promise<{
    duration: number;
    width: number;
    height: number;
    frameRate: number;
  }> {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoBlob);
    
    return new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          frameRate: 25 // Would detect from stream
        });
        
        URL.revokeObjectURL(video.src);
      });
      
      video.addEventListener('error', reject);
    });
  }
};

/**
 * Web Worker Engine using Comlink
 */
export class WebWorkerEngine {
  private workers: Map<string, Worker> = new Map();
  private wrappedWorkers: Map<string, any> = new Map();
  
  /**
   * Create worker
   */
  createWorker(id: string, workerScript: string): any {
    const worker = new Worker(workerScript, { type: 'module' });
    const wrapped = wrap(worker);
    
    this.workers.set(id, worker);
    this.wrappedWorkers.set(id, wrapped);
    
    console.log(`✅ Worker created: ${id}`);
    
    return wrapped;
  }
  
  /**
   * Get worker
   */
  getWorker(id: string): any {
    return this.wrappedWorkers.get(id);
  }
  
  /**
   * Terminate worker
   */
  terminateWorker(id: string) {
    const worker = this.workers.get(id);
    if (worker) {
      worker.terminate();
      this.workers.delete(id);
      this.wrappedWorkers.delete(id);
      console.log(`🗑️ Worker terminated: ${id}`);
    }
  }
  
  /**
   * Terminate all workers
   */
  terminateAll() {
    this.workers.forEach((worker, id) => {
      worker.terminate();
      console.log(`🗑️ Worker terminated: ${id}`);
    });
    
    this.workers.clear();
    this.wrappedWorkers.clear();
  }
}

export const webWorkerEngine = new WebWorkerEngine();

// Expose worker functions for use in worker context
if (typeof WorkerGlobalScope !=='undefined' && self instanceof WorkerGlobalScope) {
  expose(videoWorkerFunctions);
}


