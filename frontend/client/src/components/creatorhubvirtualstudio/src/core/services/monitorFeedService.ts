/**
 * Monitor Feed Service
 * 
 * Renders camera views to textures for display on 3D monitor props.
 * Supports multi-camera layouts, live switching, and technical overlays.
 */

import * as THREE from 'three';
import { logger } from './logger';

const log = logger.module('MonitorFeedService');

// ============================================================================
// Types
// ============================================================================

export type MonitorLayout = 'single' | '2x1' | '2x2' | '3x3' | 'pip';

export interface MonitorFeed {
  cameraId: string;
  cameraName: string;
  isLive: boolean;
  isRecording: boolean;
}

export interface MonitorConfig {
  id: string;
  layout: MonitorLayout;
  feeds: MonitorFeed[];
  activeFeedIndex: number;
  showTimecode: boolean;
  showWaveform: boolean;
  showHistogram: boolean;
  showSafeAreas: boolean;
  showCameraInfo: boolean;
  brightness: number;
}

export interface CameraNode {
  id: string;
  name: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
  };
  camera?: {
    focalLength: number;
    sensor: [number, number];
    aperture: number;
  };
}

// ============================================================================
// Monitor Renderer Class
// ============================================================================

export class MonitorRenderer {
  private renderer: any;
  private renderTargets: Map<string, any> = new Map();
  private cameras: Map<string, any> = new Map();
  private scene: any;
  private canvas: HTMLCanvasElement | null = null;
  private config: MonitorConfig = {
    id: 'main-monitor',
    layout: 'single',
    feeds: [],
    activeFeedIndex: 0,
    showTimecode: true,
    showWaveform: false,
    showHistogram: false,
    showSafeAreas: true,
    showCameraInfo: true,
    brightness: 1.0,
  };
  private timecode: number = 0;
  private frameCount: number = 0;
  
  constructor(width: number = 512, height: number = 288) {
    if (!THREE) {
      log.warn('Three.js not available');
      return;
    }
    
    // Create offscreen canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    
    log.info('MonitorRenderer initialized', { width, height });
  }
  
  /**
   * Set the scene to render from
   */
  setScene(scene: any) {
    this.scene = scene;
  }
  
  /**
   * Update monitor configuration
   */
  setConfig(config: Partial<MonitorConfig>) {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Register a camera for rendering
   */
  registerCamera(node: CameraNode) {
    if (!THREE) return;
    
    const sensor = node.camera?.sensor || [36, 24];
    const focalLength = node.camera?.focalLength || 50;
    
    // Calculate FOV from sensor and focal length
    const fovRad = 2 * Math.atan(sensor[1] / 2 / focalLength);
    const fovDeg = (fovRad * 180) / Math.PI;
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(fovDeg, 16 / 9, 0.1, 1000);
    camera.position.set(
      node.transform.position[0],
      node.transform.position[1],
      node.transform.position[2]
    );
    
    // Look at origin (subject)
    camera.lookAt(0, node.transform.position[1], 0);
    
    this.cameras.set(node.id, camera);
    
    // Create render target for this camera
    const target = new THREE.WebGLRenderTarget(256, 144, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    this.renderTargets.set(node.id, target);
    
    // Add to feeds if not already
    if (!this.config.feeds.find(f => f.cameraId === node.id)) {
      this.config.feeds.push({
        cameraId: node.id,
        cameraName: node.name || `CAM ${this.config.feeds.length + 1}`,
        isLive: this.config.feeds.length === 0, // First camera is live
        isRecording: false,
      });
    }
    
    log.debug('Registered camera: ', node.id);
  }
  
  /**
   * Update camera position/settings
   */
  updateCamera(node: CameraNode) {
    const camera = this.cameras.get(node.id);
    if (!camera) return;
    
    const sensor = node.camera?.sensor || [36, 24];
    const focalLength = node.camera?.focalLength || 50;
    
    const fovRad = 2 * Math.atan(sensor[1] / 2 / focalLength);
    camera.fov = (fovRad * 180) / Math.PI;
    camera.updateProjectionMatrix();
    
    camera.position.set(
      node.transform.position[0],
      node.transform.position[1],
      node.transform.position[2]
    );
    
    camera.lookAt(0, node.transform.position[1], 0);
  }
  
  /**
   * Remove a camera
   */
  unregisterCamera(cameraId: string) {
    this.cameras.delete(cameraId);
    
    const target = this.renderTargets.get(cameraId);
    if (target) {
      target.dispose();
      this.renderTargets.delete(cameraId);
    }
    
    this.config.feeds = this.config.feeds.filter(f => f.cameraId !== cameraId);
  }
  
  /**
   * Set the active (main) camera
   */
  setActiveCamera(cameraId: string) {
    const index = this.config.feeds.findIndex(f => f.cameraId === cameraId);
    if (index >= 0) {
      this.config.activeFeedIndex = index;
      this.config.feeds.forEach((f, i) => {
        f.isLive = i === index;
      });
    }
  }
  
  /**
   * Toggle recording on a camera
   */
  toggleRecording(cameraId: string) {
    const feed = this.config.feeds.find(f => f.cameraId === cameraId);
    if (feed) {
      feed.isRecording = !feed.isRecording;
    }
  }
  
  /**
   * Cycle to next camera
   */
  cycleCamera() {
    const nextIndex = (this.config.activeFeedIndex + 1) % this.config.feeds.length;
    if (this.config.feeds[nextIndex]) {
      this.setActiveCamera(this.config.feeds[nextIndex].cameraId);
    }
  }
  
  /**
   * Render all camera feeds and composite to monitor texture
   */
  render(): any {
    if (!THREE || !this.scene || !this.renderer) return null;
    
    this.frameCount++;
    this.timecode += 1 / 24; // Assume 24fps
    
    // Render each camera to its target
    this.cameras.forEach((camera, cameraId) => {
      const target = this.renderTargets.get(cameraId);
      if (target) {
        this.renderer.setRenderTarget(target);
        this.renderer.render(this.scene, camera);
      }
    });
    
    // Composite based on layout
    this.renderer.setRenderTarget(null);
    this.compositeLayout();
    
    return this.getTexture();
  }
  
  /**
   * Composite feeds based on layout
   */
  private compositeLayout() {
    if (!this.canvas) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Clear with dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);
    
    const feeds = this.config.feeds;
    const layout = this.config.layout;
    
    if (feeds.length === 0) {
      this.drawNoSignal(ctx, 0, 0, w, h);
      return;
    }
    
    switch (layout) {
      case 'single':
        this.drawFeed(ctx, 0, feeds[this.config.activeFeedIndex], 0, 0, w, h);
        break;
        
      case '2x1':
        this.drawFeed(ctx, 0, feeds[0], 0, 0, w / 2, h);
        this.drawFeed(ctx, 1, feeds[1], w / 2, 0, w / 2, h);
        break;
        
      case '2x2':
        this.drawFeed(ctx, 0, feeds[0], 0, 0, w / 2, h / 2);
        this.drawFeed(ctx, 1, feeds[1], w / 2, 0, w / 2, h / 2);
        this.drawFeed(ctx, 2, feeds[2], 0, h / 2, w / 2, h / 2);
        this.drawFeed(ctx, 3, feeds[3], w / 2, h / 2, w / 2, h / 2);
        break;
        
      case '3x3': {
        const cellW = w / 3;
        const cellH = h / 3;
        for (let i = 0; i < 9 && i < feeds.length; i++) {
          const col = i % 3;
          const row = Math.floor(i / 3);
          this.drawFeed(ctx, i, feeds[i], col * cellW, row * cellH, cellW, cellH);
        }
        break;
      }

      case 'pip': { // Picture-in-picture
        this.drawFeed(ctx, 0, feeds[this.config.activeFeedIndex], 0, 0, w, h);
        // Small PIP in corner
        const pipW = w * 0.25;
        const pipH = h * 0.25;
        const pipX = w - pipW - 10;
        const pipY = h - pipH - 10;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(pipX - 1, pipY - 1, pipW + 2, pipH + 2);
        const nextIndex = (this.config.activeFeedIndex + 1) % feeds.length;
        this.drawFeed(ctx, nextIndex, feeds[nextIndex], pipX, pipY, pipW, pipH);
        break;
      }
    }
    
    // Draw overlays
    if (this.config.showTimecode) {
      this.drawTimecode(ctx);
    }
  }
  
  /**
   * Draw a single feed
   */
  private drawFeed(
    ctx: CanvasRenderingContext2D,
    index: number,
    feed: MonitorFeed | undefined,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    if (!feed) {
      this.drawNoSignal(ctx, x, y, w, h);
      return;
    }
    
    const target = this.renderTargets.get(feed.cameraId);
    if (!target) {
      this.drawNoSignal(ctx, x, y, w, h);
      return;
    }
    
    // Read pixels from render target
    const pixels = new Uint8Array(target.width * target.height * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
    
    // Create ImageData
    const imageData = new ImageData(
      new Uint8ClampedArray(pixels.buffer),
      target.width,
      target.height
    );
    
    // Draw to temp canvas then scale
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = target.width;
    tempCanvas.height = target.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0);
      // Flip vertically (WebGL is upside down)
      ctx.save();
      ctx.translate(x, y + h);
      ctx.scale(1, -1);
      ctx.drawImage(tempCanvas, 0, 0, w, h);
      ctx.restore();
    }
    
    // Draw border
    ctx.strokeStyle = feed.isLive ? '#ff0000' : '#333333';
    ctx.lineWidth = feed.isLive ? 3 : 1;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    
    // Draw camera info
    if (this.config.showCameraInfo) {
      ctx.font = '12px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 2;
      ctx.fillText(feed.cameraName, x + 8, y + 16);
      
      if (feed.isLive) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x + 8, y + 22, 8, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('LIVE', x + 20, y + 30);
      }
      
      if (feed.isRecording) {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(x + w - 20, y + 20, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('REC', x + w - 50, y + 24);
      }
      
      ctx.shadowBlur = 0;
    }
    
    // Draw safe areas
    if (this.config.showSafeAreas && (feed.isLive || this.config.layout === 'single')) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      // Action safe (90%)
      const safeW = w * 0.9;
      const safeH = h * 0.9;
      ctx.strokeRect(x + (w - safeW) / 2, y + (h - safeH) / 2, safeW, safeH);
      // Title safe (80%)
      const titleW = w * 0.8;
      const titleH = h * 0.8;
      ctx.strokeRect(x + (w - titleW) / 2, y + (h - titleH) / 2, titleW, titleH);
      ctx.setLineDash([]);
    }
  }
  
  /**
   * Draw "No Signal" placeholder
   */
  private drawNoSignal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(x, y, w, h);
    
    // Static noise
    const imageData = ctx.createImageData(w, h);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 30;
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, x, y);
    
    ctx.font = '16px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('NO SIGNAL', x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
  }
  
  /**
   * Draw timecode overlay
   */
  private drawTimecode(ctx: CanvasRenderingContext2D) {
    if (!this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Format timecode
    const totalSeconds = Math.floor(this.timecode);
    const frames = Math.floor((this.timecode % 1) * 24);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    
    const tc = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor ='#000000';
    ctx.shadowBlur = 2;
    ctx.fillText(tc, w - 110, h - 10);
    ctx.shadowBlur = 0;
  }
  
  /**
   * Get the rendered texture
   */
  getTexture(): any {
    if (!THREE || !this.canvas) return null;
    
    const texture = new THREE.CanvasTexture(this.canvas);
    texture.needsUpdate = true;
    return texture;
  }
  
  /**
   * Get canvas for direct use
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
  
  /**
   * Dispose resources
   */
  dispose() {
    this.renderTargets.forEach(target => target.dispose());
    this.renderTargets.clear();
    this.cameras.clear();
    this.renderer?.dispose();
    log.info('MonitorRenderer disposed');
  }
}

// ============================================================================
// Singleton Service
// ============================================================================

let monitorRenderer: MonitorRenderer | null = null;

export const monitorFeedService = {
  /**
   * Initialize the monitor renderer
   */
  init(width?: number, height?: number): MonitorRenderer {
    if (!monitorRenderer) {
      monitorRenderer = new MonitorRenderer(width, height);
    }
    return monitorRenderer;
  },
  
  /**
   * Get the current renderer
   */
  getRenderer(): MonitorRenderer | null {
    return monitorRenderer;
  },
  
  /**
   * Dispose the renderer
   */
  dispose() {
    monitorRenderer?.dispose();
    monitorRenderer = null;
  },
};

export default monitorFeedService;
