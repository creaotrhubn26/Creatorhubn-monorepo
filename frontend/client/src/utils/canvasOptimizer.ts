/**
 * Canvas Optimization Utilities
 * Optimize canvas rendering and interaction performance
 */

export interface CanvasConfig {
  enableHardwareAcceleration: boolean;
  enableOffscreenCanvas: boolean;
  enableWebGL: boolean;
  enableImageSmoothing: boolean;
  enablePixelRatioScaling: boolean;
  enableViewportCulling: boolean;
  enableLOD: boolean; // Level of Detail
  enableBatching: boolean;
  enableCaching: boolean;
  maxFPS: number;
  targetFPS: number;
  renderDistance: number;
  cacheSize: number;
}

export interface CanvasMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  vertices: number;
  textures: number;
  memoryUsage: number;
  renderTime: number;
  cullTime: number;
  batchTime: number;
}

export interface RenderObject {
  id: string;
  type: 'rectangle, ' | 'circle' | 'line' | 'text' | 'image' | 'path';
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  layer: number;
  data: any;
  cached: boolean;
  lastRendered: number;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  rotation: number;
}

export interface OptimizationResult {
  success: boolean;
  improvements: Array<{
    type: 'performance' | 'memory' | 'rendering' | 'interaction';
    description: string;
    impact: 'low' | 'medium' | 'high';
    before: number;
    after: number;
    improvement: number;
}>;
  recommendations: Array<{
    type: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    action: string;
    estimatedImprovement: number;
}>;
}

class CanvasOptimizer {
  private config: CanvasConfig;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private gl: WebGLRenderingContext | null = null;
  private metrics: CanvasMetrics;
  private renderObjects: Map<string, RenderObject> = new Map();
  private viewport: Viewport;
  private frameCount = 0;
  private lastFrameTime = 0;
  private animationFrameId: number | null = null;
  private isRendering = false;
  private renderQueue: RenderObject[] = [];
  private cache: Map<string, HTMLCanvasElement> = new Map();
  private performanceHistory: number[] = [];

  constructor(config: Partial<CanvasConfig> = {}) {
    this.config = {
      enableHardwareAcceleration: true,
      enableOffscreenCanvas: true,
      enableWebGL: false,
      enableImageSmoothing: true,
      enablePixelRatioScaling: true,
      enableViewportCulling: true,
      enableLOD: true,
      enableBatching: true,
      enableCaching: true,
      maxFPS: 60,
      targetFPS: 30,
      renderDistance: 1000,
      cacheSize: 50,
      ...config
  };

    this.metrics = {
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      textures: 0,
      memoryUsage: 0,
      renderTime: 0,
      cullTime: 0,
      batchTime: 0
  };

    this.viewport = {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      zoom: 1,
      rotation: 0
  };

    this.initializeOptimizer();
}

  /**
   * Initialize optimizer
   */
  private initializeOptimizer(): void {
    this.setupPerformanceMonitoring();
    this.setupMemoryOptimization();
}

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Monitor FPS
    const trackFPS = (timestamp: number) => {
      if (this.lastFrameTime) {
        const deltaTime = timestamp - this.lastFrameTime;
        this.frameCount++;
        
        if (this.frameCount >= 60) {
          this.metrics.fps = Math.round(1000 / (deltaTime / this.frameCount));
          this.frameCount = 0;
      }
    }
      
      this.lastFrameTime = timestamp;
      requestAnimationFrame(trackFPS);
  };
    
    requestAnimationFrame(trackFPS);
}

  /**
   * Setup memory optimization
   */
  private setupMemoryOptimization(): void {
    // Monitor memory usage
    setInterval(() => {
      this.optimizeMemory();
  }, 5000);
}

  /**
   * Initialize canvas
   */
  initializeCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d, ', {
      alpha: true,
      desynchronized: true,
      willReadFrequently: false
  });

    if (!this.ctx) {
      throw new Error('Failed to get 2D context');
  }

    // Setup canvas optimizations
    this.setupCanvasOptimizations();

    // Setup WebGL if enabled
    if (this.config.enableWebGL) {
      this.setupWebGL();
  }
}

  /**
   * Setup canvas optimizations
   */
  private setupCanvasOptimizations(): void {
    if (!this.ctx) return;

    // Enable hardware acceleration
    if (this.config.enableHardwareAcceleration) {
      this.ctx.imageSmoothingEnabled = this.config.enableImageSmoothing;
      this.ctx.imageSmoothingQuality = 'high';
  }

    // Setup pixel ratio scaling
    if (this.config.enablePixelRatioScaling) {
      const pixelRatio = window.devicePixelRatio || 1;
      this.canvas!.width = this.viewport.width * pixelRatio;
      this.canvas!.height = this.viewport.height * pixelRatio;
      this.canvas!.style.width = `${this.viewport.width}px`;
      this.canvas!.style.height = `${this.viewport.height}px`;
      this.ctx.scale(pixelRatio, pixelRatio);
  }
}

  /**
   * Setup WebGL
   */
  private setupWebGL(): void {
    if (!this.canvas) return;

    this.gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: true,
      stencil: true,
      preserveDrawingBuffer: false
  });

    if (!this.gl) {
      console.warn('WebGL not available, falling back to 2D context');
      return;
  }

    // Setup WebGL optimizations
    this.setupWebGLOptimizations();
}

  /**
   * Setup WebGL optimizations
   */
  private setupWebGLOptimizations(): void {
    if (!this.gl) return;

    // Enable depth testing
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);

    // Enable blending
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // Enable culling
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.cullFace(this.gl.BACK);

    // Set clear color
    this.gl.clearColor(00, 0);
}

  /**
   * Add render object
   */
  addRenderObject(obj: RenderObject): void {
    this.renderObjects.set(obj.id, obj);
    
    if (this.config.enableBatching) {
      this.renderQueue.push(obj);
  }
}

  /**
   * Remove render object
   */
  removeRenderObject(id: string): void {
    this.renderObjects.delete(id);
    
    if (this.config.enableBatching) {
      this.renderQueue = this.renderQueue.filter(obj => obj.id !== id);
  }
}

  /**
   * Update render object
   */
  updateRenderObject(id: string, updates: Partial<RenderObject>): void {
    const obj = this.renderObjects.get(id);
    if (obj) {
      Object.assign(obj, updates);
      obj.lastRendered = Date.now();
  }
}

  /**
   * Set viewport
   */
  setViewport(viewport: Partial<Viewport>): void {
    this.viewport = { ...this.viewport, ...viewport };
    
    if (this.canvas) {
      this.canvas.width = this.viewport.width;
      this.canvas.height = this.viewport.height;
  }
}

  /**
   * Start rendering
   */
  startRendering(): void {
    if (this.isRendering) return;
    
    this.isRendering = true;
    this.render();
}

  /**
   * Stop rendering
   */
  stopRendering(): void {
    this.isRendering = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
  }
}

  /**
   * Main render loop
   */
  private render(): void {
    if (!this.isRendering) return;

    const startTime = performance.now();
    
    // Clear canvas
    this.clearCanvas();
    
    // Cull objects outside viewport
    const visibleObjects = this.cullObjects();
    
    // Batch render calls
    const batches = this.batchObjects(visibleObjects);
    
    // Render batches
    this.renderBatches(batches);
    
    // Update metrics
    const endTime = performance.now();
    this.updateMetrics(endTime - startTime);
    
    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(() => this.render());
}

  /**
   * Clear canvas
   */
  private clearCanvas(): void {
    if (this.gl) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  } else if (this.ctx) {
      this.ctx.clearRect(0this.viewport.width, this.viewport.height);
  }
}

  /**
   * Cull objects outside viewport
   */
  private cullObjects(): RenderObject[] {
    if (!this.config.enableViewportCulling) {
      return Array.from(this.renderObjects.values());
  }

    const startTime = performance.now();
    const visibleObjects: RenderObject[] = [];
    
    for (const obj of Array.from(this.renderObjects.values())) {
      if (this.isObjectVisible(obj)) {
        visibleObjects.push(obj);
    }
  }
    
    const endTime = performance.now();
    this.metrics.cullTime = endTime - startTime;
    
    return visibleObjects;
}

  /**
   * Check if object is visible in viewport
   */
  private isObjectVisible(obj: RenderObject): boolean {
    const objLeft = obj.x;
    const objRight = obj.x + obj.width;
    const objTop = obj.y;
    const objBottom = obj.y + obj.height;
    
    const viewLeft = this.viewport.x;
    const viewRight = this.viewport.x + this.viewport.width;
    const viewTop = this.viewport.y;
    const viewBottom = this.viewport.y + this.viewport.height;
    
    return !(objRight < viewLeft || objLeft > viewRight || objBottom < viewTop || objTop > viewBottom);
}

  /**
   * Batch objects for efficient rendering
   */
  private batchObjects(objects: RenderObject[]): RenderObject[][] {
    if (!this.config.enableBatching) {
      return objects.map(obj => [obj]);
  }

    const startTime = performance.now();
    const batches: RenderObject[][] = [];
    const typeMap = new Map<string, RenderObject[]>();
    
    // Group objects by type
    for (const obj of objects) {
      if (!typeMap.has(obj.type)) {
        typeMap.set(obj.type, []);
    }
      typeMap.get(obj.type)!.push(obj);
  }
    
    // Create batches
    for (const [type, objs] of Array.from(typeMap.entries())) {
      const batchSize = this.getBatchSize(type);
      for (let i = 0; i < objs.length; i += batchSize) {
        batches.push(objs.slice(i, i + batchSize));
    }
  }
    
    const endTime = performance.now();
    this.metrics.batchTime = endTime - startTime;
    
    return batches;
}

  /**
   * Get batch size for object type
   */
  private getBatchSize(type: string): number {
    const batchSizes: Record<string, number> = {
      'rectangle': 100 'circle': 100,
      'line': 50,
      'text': 20,
      'image': 10,
      'path': 5
  };
    
    return batchSizes[type] || 50;
}

  /**
   * Render batches
   */
  private renderBatches(batches: RenderObject[][]): void {
    const startTime = performance.now();
    
    for (const batch of batches) {
      if (batch.length === 0) continue;
      
      const type = batch[0].type;
      
      switch (type) {
        case 'rectangle':
          this.renderRectangleBatch(batch);
          break;
        case 'circle':
          this.renderCircleBatch(batch);
          break;
        case 'line':
          this.renderLineBatch(batch);
          break;
        case 'text':
          this.renderTextBatch(batch);
          break;
        case 'image':
          this.renderImageBatch(batch);
          break;
        case 'path':
          this.renderPathBatch(batch);
          break;
    }
  }
    
    const endTime = performance.now();
    this.metrics.renderTime = endTime - startTime;
}

  /**
   * Render rectangle batch
   */
  private renderRectangleBatch(batch: RenderObject[]): void {
    if (!this.ctx) return;
    
    this.ctx.beginPath();
    
    for (const obj of batch) {
      this.ctx.rect(obj.x, obj.y, obj.width, obj.height);
  }
    
    this.ctx.fill();
    this.metrics.drawCalls++;
}

  /**
   * Render circle batch
   */
  private renderCircleBatch(batch: RenderObject[]): void {
    if (!this.ctx) return;
    
    for (const obj of batch) {
      this.ctx.beginPath();
      this.ctx.arc(obj.x + obj.width /2, obj.y + obj.height / 2, obj.width / 2Math.PI * 2);
      this.ctx.fill();
      this.metrics.drawCalls++;
  }
}

  /**
   * Render line batch
   */
  private renderLineBatch(batch: RenderObject[]): void {
    if (!this.ctx) return;
    
    this.ctx.beginPath();
    
    for (const obj of batch) {
      this.ctx.moveTo(obj.x, obj.y);
      this.ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
  }
    
    this.ctx.stroke();
    this.metrics.drawCalls++;
}

  /**
   * Render text batch
   */
  private renderTextBatch(batch: RenderObject[]): void {
    if (!this.ctx) return;
    
    for (const obj of batch) {
      this.ctx.fillText(obj.data.text || ', ', obj.x, obj.y);
      this.metrics.drawCalls++;
  }
}

  /**
   * Render image batch
   */
  private renderImageBatch(batch: RenderObject[]): void {
    if (!this.ctx) return;
    
    for (const obj of batch) {
      if (obj.data.image) {
        this.ctx.drawImage(obj.data.image, obj.x, obj.y, obj.width, obj.height);
        this.metrics.drawCalls++;
    }
  }
}

  /**
   * Render path batch
   */
  private renderPathBatch(batch: RenderObject[]): void {
    if (!this.ctx) return;
    
    for (const obj of batch) {
      this.ctx.beginPath();
      this.ctx.moveTo(obj.x, obj.y);
      
      if (obj.data.points) {
        for (const point of obj.data.points) {
          this.ctx.lineTo(point.x, point.y);
      }
    }
      
      this.ctx.stroke();
      this.metrics.drawCalls++;
  }
}

  /**
   * Update metrics
   */
  private updateMetrics(renderTime: number): void {
    this.metrics.frameTime = renderTime;
    this.metrics.triangles = this.calculateTriangles();
    this.metrics.vertices = this.calculateVertices();
    this.metrics.textures = this.calculateTextures();
    this.metrics.memoryUsage = this.calculateMemoryUsage();
    
    this.performanceHistory.push(renderTime);
    
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
  }
}

  /**
   * Calculate triangles
   */
  private calculateTriangles(): number {
    let triangles = 0;
    
    for (const obj of Array.from(this.renderObjects.values())) {
      switch (obj.type) {
        case 'rectangle':
          triangles += 2;
          break;
        case 'circle':
          triangles += 32; // Approximate
          break;
        case 'line':
          triangles += 2;
          break;
        case 'text':
          triangles += 2;
          break;
        case 'image':
          triangles += 2;
          break;
        case 'path':
          triangles += obj.data.points ? obj.data.points.length - 1 : 0;
          break;
    }
  }
    
    return triangles;
}

  /**
   * Calculate vertices
   */
  private calculateVertices(): number {
    return this.calculateTriangles() * 3;
}

  /**
   * Calculate textures
   */
  private calculateTextures(): number {
    let textures = 0;
    
    for (const obj of Array.from(this.renderObjects.values())) {
      if (obj.type === 'image' && obj.data.image) {
        textures++;
    }
  }
    
    return textures;
}

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    let memory = 0;
    
    // Canvas memory
    if (this.canvas) {
      memory += this.canvas.width * this.canvas.height * 4; // RGBA
  }
    
    // Cache memory
    for (const cached of Array.from(this.cache.values())) {
      memory += cached.width * cached.height * 4;
  }
    
    return memory / 1024 / 1024; // Convert to MB
}

  /**
   * Optimize memory
   */
  private optimizeMemory(): void {
    if (this.cache.size > this.config.cacheSize) {
      // Remove oldest cache entries (FIFO since HTMLCanvasElement doesn't track lastRendered)
      const entries = Array.from(this.cache.entries());
      
      const toRemove = entries.slice(0, entries.length - this.config.cacheSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
    }
  }
    
    // Remove old render objects
    const now = Date.now();
    for (const [id, obj] of Array.from(this.renderObjects.entries())) {
      if (now - obj.lastRendered > 60000) { // 1 minute
        this.renderObjects.delete(id);
    }
  }
}

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): OptimizationResult {
    const improvements: Array<any> = [];
    const recommendations: Array<any> = [];
    
    // FPS recommendations
    if (this.metrics.fps < this.config.targetFPS) {
      improvements.push({
        type: 'performance',
        description: 'Low FPS detected',
        impact: 'high',
        before: this.metrics.fps,
        after: this.config.targetFPS,
        improvement: this.config.targetFPS - this.metrics.fps
    });
      
      recommendations.push({
        type: 'performance',
        priority: 'high',
        description: 'Reduce draw calls and enable batching',
        action: 'Enable object batching and reduce individual draw calls',
        estimatedImprovement: 20
});
  }
    
    // Memory recommendations
    if (this.metrics.memoryUsage > 100) { // 100MB
      improvements.push({
        type: 'memory',
        description: 'High memory usage',
        impact: 'medium',
        before: this.metrics.memoryUsage,
        after: 50,
        improvement: this.metrics.memoryUsage - 50
});
      
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        description: 'Enable viewport culling and reduce cache size',
        action: 'Enable viewport culling and reduce cache size',
        estimatedImprovement: 30
});
  }
    
    // Rendering recommendations
    if (this.metrics.drawCalls > 1000) {
      improvements.push({
        type: 'rendering',
        description: 'Too many draw calls',
        impact: 'high',
        before: this.metrics.drawCalls,
        after: 500,
        improvement: this.metrics.drawCalls - 500
});
      
      recommendations.push({
        type: 'rendering',
        priority: 'high',
        description: 'Enable batching and reduce individual draw calls',
        action: 'Enable object batching and combine similar objects',
        estimatedImprovement: 50
});
  }
    
    return {
      success: improvements.length > 0,
      improvements,
      recommendations
  };
}

  /**
   * Get current metrics
   */
  getMetrics(): CanvasMetrics {
    return { ...this.metrics };
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CanvasConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.canvas) {
      this.setupCanvasOptimizations();
  }
}

  /**
   * Get configuration
   */
  getConfig(): CanvasConfig {
    return { ...this.config };
}

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopRendering();
    this.renderObjects.clear();
    this.renderQueue = [];
    this.cache.clear();
    this.performanceHistory = [];
}
}

// Create singleton instance
export const canvasOptimizer = new CanvasOptimizer();

// Utility functions
export const initializeCanvas = (canvas: HTMLCanvasElement) => {
  canvasOptimizer.initializeCanvas(canvas);
};

export const addRenderObject = (obj: RenderObject) => {
  canvasOptimizer.addRenderObject(obj);
};

export const removeRenderObject = (id: string) => {
  canvasOptimizer.removeRenderObject(id);
};

export const updateRenderObject = (id: string, updates: Partial<RenderObject>) => {
  canvasOptimizer.updateRenderObject(id, updates);
};

export const setViewport = (viewport: Partial<Viewport>) => {
  canvasOptimizer.setViewport(viewport);
};

export const startRendering = () => {
  canvasOptimizer.startRendering();
};

export const stopRendering = () => {
  canvasOptimizer.stopRendering();
};

export const getMetrics = () => {
  return canvasOptimizer.getMetrics();
};

export const getOptimizationRecommendations = () => {
  return canvasOptimizer.getOptimizationRecommendations();
};

export default canvasOptimizer;





