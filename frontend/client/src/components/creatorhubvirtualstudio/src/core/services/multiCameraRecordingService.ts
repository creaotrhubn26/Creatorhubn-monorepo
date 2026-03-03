/**
 * Multi-Camera Recording Service
 * 
 * Records video from multiple camera angles simultaneously.
 * Each camera gets its own video file with synchronized timecode.
 */

import { logger } from './logger';

const log = logger.module('MultiCameraRecording, ');

let THREE: any = null;
try {
  THREE = require('three');
} catch {}

// ============================================================================
// Types
// ============================================================================

export interface CameraRecording {
  cameraId: string;
  cameraName: string;
  isRecording: boolean;
  startTime: number | null;
  duration: number;
  frameCount: number;
  blob: Blob | null;
  url: string | null;
}

export interface RecordingConfig {
  format: 'webm' | 'mp4';
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

export interface MultiCameraRecordingState {
  isRecording: boolean;
  recordings: Map<string, CameraRecording>;
  startTime: number | null;
  elapsedTime: number;
}

// ============================================================================
// Quality Presets
// ============================================================================

export const RECORDING_QUALITY = {
  low: { bitrate: 2_500_000, width: 854, height: 480 },
  medium: { bitrate: 5_000_000, width: 1280, height: 720 },
  high: { bitrate: 10_000_000, width: 1920, height: 1080 },
  ultra: { bitrate: 20_000_000, width: 2560, height: 1440 },
};

// ============================================================================
// Camera Recorder Class
// ============================================================================

class CameraRecorder {
  private cameraId: string;
  private cameraName: string;
  private renderer: any;
  private scene: any;
  private camera: any;
  private sourceCamera: any; // Reference to the actual scene camera to sync from
  private renderTarget: any;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;
  private startTime: number | null = null;
  private frameCount = 0;
  private config: RecordingConfig;
  private animationFrameId: number | null = null;
  private getCameraTransform: (() => { position: any; rotation: any; fov?: number }) | null = null;
  
  constructor(
    cameraId: string,
    cameraName: string,
    scene: any,
    camera: any,
    config: RecordingConfig,
    getCameraTransform?: () => { position: any; rotation: any; fov?: number }
  ) {
    this.cameraId = cameraId;
    this.cameraName = cameraName;
    this.scene = scene;
    this.sourceCamera = camera; // Store reference to source camera
    this.config = config;
    this.getCameraTransform = getCameraTransform || null;
    
    if (!THREE) {
      log.warn('Three.js not available, ');
      return;
    }
    
    // Create offscreen canvas for this camera
    this.canvas = document.createElement('canvas');
    this.canvas.width = config.width;
    this.canvas.height = config.height;
    this.ctx = this.canvas.getContext('2d');
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(config.width, config.height, false);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    
    // Create render target
    this.renderTarget = new THREE.WebGLRenderTarget(config.width, config.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    
    // Create recording camera (clone of source camera or new if source is a transform getter)
    if (this.sourceCamera && this.sourceCamera.isPerspectiveCamera) {
      // Clone the source camera for recording
      this.camera = this.sourceCamera.clone();
    } else {
      // Create a new camera with default settings
      this.camera = new THREE.PerspectiveCamera(50, config.width / config.height, 0.1, 1000);
    }
    
    log.debug(`CameraRecorder initialized: ${cameraId}`, { width: config.width, height: config.height });
  }
  
  /**
   * Update source camera reference (for live sync)
   */
  setSourceCamera(camera: any) {
    this.sourceCamera = camera;
  }
  
  /**
   * Sync recording camera with source camera transforms
   */
  private syncCameraTransform() {
    if (!this.camera || !THREE) return;
    
    // Option 1: Use transform getter function if provided
    if (this.getCameraTransform) {
      const transform = this.getCameraTransform();
      if (transform.position) {
        this.camera.position.copy(transform.position);
      }
      if (transform.rotation) {
        if (transform.rotation.isEuler) {
          this.camera.rotation.copy(transform.rotation);
        } else if (transform.rotation.isQuaternion) {
          this.camera.quaternion.copy(transform.rotation);
        }
      }
      if (transform.fov !== undefined) {
        this.camera.fov = transform.fov;
        this.camera.updateProjectionMatrix();
      }
      return;
    }
    
    // Option 2: Sync from source camera directly
    if (this.sourceCamera) {
      // Copy position
      if (this.sourceCamera.position) {
        this.camera.position.copy(this.sourceCamera.position);
      }
      
      // Copy rotation (quaternion for accuracy)
      if (this.sourceCamera.quaternion) {
        this.camera.quaternion.copy(this.sourceCamera.quaternion);
      } else if (this.sourceCamera.rotation) {
        this.camera.rotation.copy(this.sourceCamera.rotation);
      }
      
      // Copy projection properties
      if (this.sourceCamera.fov !== undefined && this.camera.fov !== this.sourceCamera.fov) {
        this.camera.fov = this.sourceCamera.fov;
        this.camera.updateProjectionMatrix();
      }
      
      // Copy matrix world if available (most accurate)
      if (this.sourceCamera.matrixWorld) {
        this.camera.matrixWorld.copy(this.sourceCamera.matrixWorld);
        this.camera.matrixWorldInverse.copy(this.sourceCamera.matrixWorldInverse);
      }
    }
  }
  
  /**
   * Start recording from this camera
   */
  async start(): Promise<boolean> {
    if (this.isRecording || !this.canvas) return false;
    
    try {
      // Get canvas stream
      const stream = this.canvas.captureStream(this.config.fps);
      
      // Determine MIME type
      const mimeType = this.config.format === 'webm' 
        ? 'video/webm;codecs=vp9' 
        : 'video/mp4';
      
      // Check if MIME type is supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        log.warn(`MIME type ${mimeType} not supported, falling back to webm`);
      }
      
      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm',
        videoBitsPerSecond: this.config.bitrate,
      });
      
      this.recordedChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
      this.startTime = Date.now();
      this.frameCount = 0;
      
      // Start render loop
      this.startRenderLoop();
      
      log.info(`Started recording camera: ${this.cameraId}`);
      return true;
    } catch (error) {
      log.error(`Failed to start recording camera ${this.cameraId}:`, error);
      return false;
    }
  }
  
  /**
   * Stop recording and return the video blob
   */
  async stop(): Promise<CameraRecording> {
    return new Promise((resolve) => {
      if (!this.isRecording || !this.mediaRecorder) {
        resolve(this.getState());
        return;
      }
      
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { 
          type: this.config.format === 'webm' ? 'video/webm' : 'video/mp4' 
        });
        const url = URL.createObjectURL(blob);
        
        const duration = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
        
        this.isRecording = false;
        this.stopRenderLoop();
        
        log.info(`Stopped recording camera: ${this.cameraId}`, { 
          duration, 
          frames: this.frameCount,
          size: blob.size 
        });
        
        resolve({
          cameraId: this.cameraId,
          cameraName: this.cameraName,
          isRecording: false,
          startTime: this.startTime,
          duration,
          frameCount: this.frameCount,
          blob,
          url,
        });
      };
      
      this.mediaRecorder.stop();
    });
  }
  
  /**
   * Get current recording state
   */
  getState(): CameraRecording {
    return {
      cameraId: this.cameraId,
      cameraName: this.cameraName,
      isRecording: this.isRecording,
      startTime: this.startTime,
      duration: this.startTime ? (Date.now() - this.startTime) / 1000 : 0,
      frameCount: this.frameCount,
      blob: null,
      url: null,
    };
  }
  
  /**
   * Render a single frame
   */
  private renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) return;
    
    // Sync camera transform from source before rendering
    this.syncCameraTransform();
    
    this.renderer.render(this.scene, this.camera);
    this.frameCount++;
    
    // Draw timecode overlay
    if (this.ctx && this.startTime) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const tc = this.formatTimecode(elapsed);
      
      // Draw timecode
      this.ctx.font = '24px monospace';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(tc, 20, this.canvas.height - 20);
      
      // Draw camera name
      this.ctx.fillText(this.cameraName, 20, 40);
      
      // Draw REC indicator
      this.ctx.fillStyle = '#ff0000';
      this.ctx.beginPath();
      this.ctx.arc(this.canvas.width - 40, 40, 12, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText('REC', this.canvas.width - 80, 48);
      
      this.ctx.shadowBlur = 0;
    }
  }
  
  /**
   * Format seconds to timecode HH:MM:SS:FF
   */
  private formatTimecode(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * this.config.fps);
    
    return [
      h.toString().padStart(2, '0'),
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0'),
      f.toString().padStart(2, '0'),
    ].join(':');
  }
  
  /**
   * Start the render loop
   */
  private startRenderLoop() {
    const targetFrameTime = 1000 / this.config.fps;
    let lastFrameTime = performance.now();
    
    const loop = () => {
      if (!this.isRecording) return;
      
      const now = performance.now();
      const elapsed = now - lastFrameTime;
      
      if (elapsed >= targetFrameTime) {
        this.renderFrame();
        lastFrameTime = now - (elapsed % targetFrameTime);
      }
      
      this.animationFrameId = requestAnimationFrame(loop);
    };
    
    this.animationFrameId = requestAnimationFrame(loop);
  }
  
  /**
   * Stop the render loop
   */
  private stopRenderLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Dispose resources
   */
  dispose() {
    this.stopRenderLoop();
    this.renderer?.dispose();
    this.renderTarget?.dispose();
  }
}

// ============================================================================
// Multi-Camera Recording Service
// ============================================================================

class MultiCameraRecordingService {
  private recorders: Map<string, CameraRecorder> = new Map();
  private scene: any = null;
  private cameras: Map<string, any> = new Map();
  private config: RecordingConfig = {
    format: 'webm',
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate: 10_000_000,
    quality: 'high',
  };
  private isRecordingAll = false;
  private globalStartTime: number | null = null;
  private listeners: Set<(state: MultiCameraRecordingState) => void> = new Set();
  
  /**
   * Set the scene to record from
   */
  setScene(scene: any) {
    this.scene = scene;
    log.info('Scene set for recording');
  }
  
  /**
   * Register a camera for recording
   * @param cameraId - Unique identifier for the camera
   * @param cameraName - Display name for the camera
   * @param camera - Three.js camera object OR null if using transform getter
   * @param getTransform - Optional function that returns current camera transform
   */
  registerCamera(
    cameraId: string, 
    cameraName: string, 
    camera: any,
    getTransform?: () => { position: any; rotation: any; fov?: number }
  ) {
    this.cameras.set(cameraId, { 
      camera, 
      name: cameraName,
      getTransform,
    });
    log.debug('Registered camera for recording: ', cameraId, { hasTransformGetter: !!getTransform });
  }
  
  /**
   * Update a registered camera's Three.js reference
   * Call this when the actual Three.js camera object changes
   */
  updateCameraReference(cameraId: string, camera: any) {
    const existing = this.cameras.get(cameraId);
    if (existing) {
      existing.camera = camera;
      
      // Also update recorder if it exists
      const recorder = this.recorders.get(cameraId);
      if (recorder) {
        recorder.setSourceCamera(camera);
      }
      
      log.debug('Updated camera reference:', cameraId);
    }
  }
  
  /**
   * Unregister a camera
   */
  unregisterCamera(cameraId: string) {
    this.cameras.delete(cameraId);
    const recorder = this.recorders.get(cameraId);
    if (recorder) {
      recorder.dispose();
      this.recorders.delete(cameraId);
    }
  }
  
  /**
   * Update recording configuration
   */
  setConfig(config: Partial<RecordingConfig>) {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Set quality preset
   */
  setQuality(quality: keyof typeof RECORDING_QUALITY) {
    const preset = RECORDING_QUALITY[quality];
    this.config = {
      ...this.config,
      quality,
      bitrate: preset.bitrate,
      width: preset.width,
      height: preset.height,
    };
  }
  
  /**
   * Start recording a specific camera
   */
  async startRecording(cameraId: string): Promise<boolean> {
    const cameraData = this.cameras.get(cameraId);
    if (!cameraData || !this.scene) {
      log.error('Camera not found or scene not set:', cameraId);
      return false;
    }
    
    // Create recorder if needed
    if (!this.recorders.has(cameraId)) {
      const recorder = new CameraRecorder(
        cameraId,
        cameraData.name,
        this.scene,
        cameraData.camera,
        this.config,
        cameraData.getTransform // Pass transform getter for live sync
      );
      this.recorders.set(cameraId, recorder);
    }
    
    const recorder = this.recorders.get(cameraId)!;
    const result = await recorder.start();
    
    this.notifyListeners();
    return result;
  }
  
  /**
   * Stop recording a specific camera
   */
  async stopRecording(cameraId: string): Promise<CameraRecording | null> {
    const recorder = this.recorders.get(cameraId);
    if (!recorder) return null;
    
    const result = await recorder.stop();
    this.notifyListeners();
    return result;
  }
  
  /**
   * Start recording ALL cameras simultaneously
   */
  async startAllCameras(): Promise<boolean> {
    if (this.cameras.size === 0) {
      log.warn('No cameras registered for recording');
      return false;
    }
    
    this.isRecordingAll = true;
    this.globalStartTime = Date.now();
    
    const results = await Promise.all(
      Array.from(this.cameras.keys()).map(id => this.startRecording(id))
    );
    
    const success = results.every(r => r);
    log.info(`Started recording all ${this.cameras.size} cameras:`, { success });
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('vs-multi-camera-recording-started', {
      detail: { cameraCount: this.cameras.size },
    }));
    
    this.notifyListeners();
    return success;
  }
  
  /**
   * Stop recording ALL cameras and return all recordings
   */
  async stopAllCameras(): Promise<CameraRecording[]> {
    this.isRecordingAll = false;
    
    const results = await Promise.all(
      Array.from(this.recorders.keys()).map(id => this.stopRecording(id))
    );
    
    const recordings = results.filter((r): r is CameraRecording => r !== null);
    
    log.info(`Stopped recording all cameras:`, { 
      count: recordings.length,
      totalSize: recordings.reduce((acc, r) => acc + (r.blob?.size || 0), 0),
    });
    
    // Dispatch event with recordings
    window.dispatchEvent(new CustomEvent('vs-multi-camera-recording-stopped', {
      detail: { recordings },
    }));
    
    this.notifyListeners();
    return recordings;
  }
  
  /**
   * Toggle recording for a camera
   */
  async toggleRecording(cameraId: string): Promise<CameraRecording | boolean> {
    const recorder = this.recorders.get(cameraId);
    if (recorder?.getState().isRecording) {
      return await this.stopRecording(cameraId) || false;
    } else {
      return await this.startRecording(cameraId);
    }
  }
  
  /**
   * Get current recording state
   */
  getState(): MultiCameraRecordingState {
    const recordings = new Map<string, CameraRecording>();
    
    this.recorders.forEach((recorder, id) => {
      recordings.set(id, recorder.getState());
    });
    
    return {
      isRecording: this.isRecordingAll,
      recordings,
      startTime: this.globalStartTime,
      elapsedTime: this.globalStartTime ? (Date.now() - this.globalStartTime) / 1000 : 0,
    };
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: MultiCameraRecordingState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify all listeners of state change
   */
  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }
  
  /**
   * Download a recording
   */
  downloadRecording(recording: CameraRecording) {
    if (!recording.url) return;
    
    const filename = `${recording.cameraName.replace(/\s+/g, '_')}_${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.${this.config.format}`;
    
    const a = document.createElement('a');
    a.href = recording.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    log.info('Downloaded recording:', filename);
  }
  
  /**
   * Download all recordings as a ZIP bundle via backend
   * 
   * Features:
   * - Uploads recordings to server
   * - Server optimizes with moov atom at start (fast-start)
   * - Converts WebM to H.264 MP4 for broad compatibility
   * - Returns streaming-ready ZIP bundle
   * 
   * @param recordings - Array of camera recordings
   * @param options - Download options
   */
  async downloadAllRecordings(
    recordings: CameraRecording[],
    options: {
      optimize?: boolean; // Enable fast-start optimization (default: true)
    } = {}
  ): Promise<void> {
    const { optimize = true } = options;
    
    // Filter to only recordings with blobs
    const validRecordings = recordings.filter(r => r.blob);
    
    if (validRecordings.length === 0) {
      log.warn('No recordings to download');
      return;
    }
    
    // If only one recording, just download directly
    if (validRecordings.length === 1) {
      this.downloadRecording(validRecordings[0]);
      return;
    }
    
    log.info(`Creating ZIP bundle with ${validRecordings.length} recordings via backend (optimize: ${optimize})...`);
    
    try {
      // Create FormData with all recordings
      const formData = new FormData();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      formData.append('timestamp', timestamp);
      formData.append('optimize', String(optimize));
      
      // Calculate total size for progress
      const totalSize = validRecordings.reduce((sum, r) => sum + (r.blob?.size || 0), 0);
      
      // Add each recording
      for (const recording of validRecordings) {
        if (recording.blob) {
          const extension = recording.blob.type.includes('mp4') ? 'mp4' : 'webm';
          const safeName = recording.cameraName.replace(/[^a-zA-Z0-9-_]/g, '_');
          const filename = `${safeName}_${recording.cameraId.slice(0, 8)}.${extension}`;
          
          formData.append('recordings', recording.blob, filename);
          formData.append('metadata[]', JSON.stringify({
            cameraId: recording.cameraId,
            cameraName: recording.cameraName,
            duration: recording.duration,
            frameCount: recording.frameCount,
            filename,
          }));
        }
      }
      
      // Notify listeners about upload progress
      this.emit('zipProgress', { 
        phase: 'uploading', 
        percent: 0,
        message: `Uploading ${validRecordings.length} recordings (${(totalSize / 1024 / 1024).toFixed(1)} MB)...`,
      });
      
      // Upload to backend for ZIP creation with optimization
      const response = await fetch('/api/virtual-studio/recordings/bundle', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      this.emit('zipProgress', { 
        phase: 'optimizing', 
        percent: 30,
        message: optimize 
          ? 'Optimizing videos with fast-start (moov atom)...' : 'Creating ZIP bundle...',
      });
      
      // Get ZIP blob from response (this waits for server to process)
      const zipBlob = await response.blob();
      
      this.emit('zipProgress', { 
        phase: 'downloading', 
        percent: 90,
        message: 'Preparing download...',
      });
      
      // Download the ZIP
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `multicam-recording-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      const sizeMB = (zipBlob.size / 1024 / 1024).toFixed(2);
      this.emit('zipProgress', { 
        phase: 'complete', 
        percent: 100,
        message: `Download complete! ${sizeMB} MB`,
      });
      
      log.info(`Downloaded ZIP bundle: multicam-recording-${timestamp}.zip (${sizeMB} MB, optimized: ${optimize})`);
      
    } catch (error) {
      log.error('Failed to create ZIP bundle via backend:', error);
      this.emit('zipProgress', { 
        phase: 'error', 
        percent: 0, 
        error: String(error),
        message:'Failed to create bundle. Downloading individually...',
      });
      
      // Fallback: download individually
      log.info('Falling back to individual downloads...');
      validRecordings.forEach(r => this.downloadRecording(r));
    }
  }
  
  /**
   * Dispose all resources
   */
  dispose() {
    this.recorders.forEach(recorder => recorder.dispose());
    this.recorders.clear();
    this.cameras.clear();
    this.listeners.clear();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const multiCameraRecordingService = new MultiCameraRecordingService();

export default multiCameraRecordingService;
