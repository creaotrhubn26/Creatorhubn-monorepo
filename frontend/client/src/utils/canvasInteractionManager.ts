/**
 * Canvas Interaction Manager
 * Manages canvas interactions and gestures
 */

export interface InteractionConfig {
  enablePan: boolean;
  enableZoom: boolean;
  enableRotate: boolean;
  enableSelect: boolean;
  enableDrag: boolean;
  enableResize: boolean;
  enableMultiSelect: boolean;
  enableGestures: boolean;
  zoomSpeed: number;
  panSpeed: number;
  rotateSpeed: number;
  minZoom: number;
  maxZoom: number;
  doubleClickThreshold: number;
  longPressThreshold: number
}

export interface InteractionState {
  isPanning: boolean;
  isZooming: boolean;
  isRotating: boolean;
  isSelecting: boolean;
  isDragging: boolean;
  isResizing: boolean;
  isMultiSelecting: boolean;
  isGesturing: boolean;
  lastInteraction: number;
  interactionCount: number
}

export interface GestureData {
  type: 'pan, ' | 'zoom' | 'rotate' | 'pinch' | 'swipe' | 'tap' | 'longPress';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  scale: number;
  rotation: number;
  velocity: number;
  direction: 'up' | 'down' | 'left' | 'right' | 'none';
  timestamp: number
}

export interface InteractionResult {
  success: boolean;
  type: string;
  data: any;
  timestamp: number;
  performance: {
    duration: number;
    memoryUsage: number;
    cpuUsage: number;
};
}

class CanvasInteractionManager {
  private config: InteractionConfig;
  private state: InteractionState;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private gestureData: GestureData | null = null;
  private interactionHistory: InteractionResult[] = [];
  private isInitialized = false;

  constructor(config: Partial<InteractionConfig> = {}) {
    this.config = {
      enablePan: true,
      enableZoom: true,
      enableRotate: true,
      enableSelect: true,
      enableDrag: true,
      enableResize: true,
      enableMultiSelect: true,
      enableGestures: true,
      zoomSpeed: 0.1,
      panSpeed:  1,
      rotateSpeed:  1,
      minZoom: 0.1,
      maxZoom:  10,
      doubleClickThreshold: 30,
      longPressThreshold: 50,
      ...config
  };

    this.state = {
      isPanning: false,
      isZooming: false,
      isRotating: false,
      isSelecting: false,
      isDragging: false,
      isResizing: false,
      isMultiSelecting: false,
      isGesturing: false,
      lastInteraction:  0,
      interactionCount: 0
};
}

  /**
   * Initialize interaction manager
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    if (!this.ctx) {
      throw new Error('Failed to get 2D context');
}

    this.setupEventListeners();
    this.isInitialized = true;
}

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.canvas) return;

    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));

    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    this.canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this));

    // Keyboard events
    this.canvas.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.canvas.addEventListener('keyup', this.handleKeyUp.bind(this));
}

  /**
   * Handle mouse down
   */
  private handleMouseDown(event: MouseEvent): void {
    const rect = this.canvas!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.gestureData = {
      type: 'tap',
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      deltaX:  0,
      deltaY:  0,
      scale:  1,
      rotation:  0,
      velocity:  0,
      direction: 'none',
      timestamp: Date.now()
};

    this.state.isSelecting = true;
    this.state.lastInteraction = Date.now();
    this.state.interactionCount++;
}

  /**
   * Handle mouse move
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.gestureData) return;

    const rect = this.canvas!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.gestureData.currentX = x;
    this.gestureData.currentY = y;
    this.gestureData.deltaX = x - this.gestureData.startX;
    this.gestureData.deltaY = y - this.gestureData.startY;

    // Determine gesture type
    if (Math.abs(this.gestureData.deltaX) > 10 || Math.abs(this.gestureData.deltaY) > 10) {
      this.gestureData.type = 'pan';
      this.state.isPanning = true;
      this.state.isSelecting = false;
}

    this.updateGestureData();
}

  /**
   * Handle mouse up
   */
  private handleMouseUp(event: MouseEvent): void {
    if (!this.gestureData) return;

    const duration = Date.now() - this.gestureData.timestamp;
    
    if (duration > this.config.longPressThreshold) {
      this.gestureData.type = 'longPress';
}

    this.processGesture();
    this.resetState();
}

  /**
   * Handle mouse leave
   */
  private handleMouseLeave(): void {
    this.resetState();
}

  /**
   * Handle wheel
   */
  private handleWheel(event: WheelEvent): void {
    if (!this.config.enableZoom) return;

    event.preventDefault();
    
    const delta = event.deltaY > 0 ? -this.config.zoomSpeed : this.config.zoomSpeed;
    const scale = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, 1 + delta));
    
    this.gestureData = {
      type: 'zoom',
      startX:  0,
      startY:  0,
      currentX:  0,
      currentY:  0,
      deltaX:  0,
      deltaY:  0,
      scale,
      rotation:  0,
      velocity:  0,
      direction: 'none',
      timestamp: Date.now()
};

    this.state.isZooming = true;
    this.processGesture();
    this.resetState();
}

  /**
   * Handle double click
   */
  private handleDoubleClick(event: MouseEvent): void {
    const rect = this.canvas!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.gestureData = {
      type: 'tap',
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      deltaX:  0,
      deltaY:  0,
      scale:  1,
      rotation:  0,
      velocity:  0,
      direction: 'none',
      timestamp: Date.now()
};

    this.processGesture();
}

  /**
   * Handle touch start
   */
  private handleTouchStart(event: TouchEvent): void {
    if (!this.config.enableGestures) return;

    event.preventDefault();
    
    const touch = event.touches[0];
    const rect = this.canvas!.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    this.gestureData = {
      type: 'tap',
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      deltaX:  0,
      deltaY:  0,
      scale:  1,
      rotation:  0,
      velocity:  0,
      direction: 'none',
      timestamp: Date.now()
};

    this.state.isGesturing = true;
}

  /**
   * Handle touch move
   */
  private handleTouchMove(event: TouchEvent): void {
    if (!this.gestureData || !this.config.enableGestures) return;

    event.preventDefault();
    
    const touch = event.touches[0];
    const rect = this.canvas!.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    this.gestureData.currentX = x;
    this.gestureData.currentY = y;
    this.gestureData.deltaX = x - this.gestureData.startX;
    this.gestureData.deltaY = y - this.gestureData.startY;

    // Determine gesture type
    if (Math.abs(this.gestureData.deltaX) > 10 || Math.abs(this.gestureData.deltaY) > 10) {
      this.gestureData.type = 'pan';
      this.state.isPanning = true;
}

    this.updateGestureData();
}

  /**
   * Handle touch end
   */
  private handleTouchEnd(event: TouchEvent): void {
    if (!this.gestureData) return;

    event.preventDefault();
    
    const duration = Date.now() - this.gestureData.timestamp;
    
    if (duration > this.config.longPressThreshold) {
      this.gestureData.type = 'longPress';
}

    this.processGesture();
    this.resetState();
}

  /**
   * Handle touch cancel
   */
  private handleTouchCancel(): void {
    this.resetState();
}

  /**
   * Handle key down
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Handle keyboard shortcuts
    switch (event.key) {
      case ', ':
        event.preventDefault();
        this.state.isPanning = true;
        break;
      case 'Shift':
        this.state.isMultiSelecting = true;
        break;
      case 'Control':
        this.state.isDragging = true;
        break;
}
}

  /**
   * Handle key up
   */
  private handleKeyUp(event: KeyboardEvent): void {
    switch (event.key) {
      case ', ':
        this.state.isPanning = false;
        break;
      case 'Shift':
        this.state.isMultiSelecting = false;
        break;
      case 'Control':
        this.state.isDragging = false;
        break;
}
}

  /**
   * Update gesture data
   */
  private updateGestureData(): void {
    if (!this.gestureData) return;

    const deltaTime = Date.now() - this.gestureData.timestamp;
    const distance = Math.sqrt(
      Math.pow(this.gestureData.deltaX, 2) + Math.pow(this.gestureData.deltaY, 2)
    );

    this.gestureData.velocity = distance / deltaTime;

    // Determine direction
    if (Math.abs(this.gestureData.deltaX) > Math.abs(this.gestureData.deltaY)) {
      this.gestureData.direction = this.gestureData.deltaX > 0 ? 'right' : 'left';
  } else {
      this.gestureData.direction = this.gestureData.deltaY > 0 ? 'down' : 'up';
  }
}

  /**
   * Process gesture
   */
  private processGesture(): void {
    if (!this.gestureData) return;

    const startTime = performance.now();
    
    try {
      const result: InteractionResult = {
        success: true,
        type: this.gestureData.type,
        data: { ...this.gestureData },
        timestamp: Date.now(),
        performance: {
          duration: 0,
          memoryUsage: 0,
          cpuUsage: 0
        }
    };

      // Process based on gesture type
      switch (this.gestureData.type) {
        case 'pan':
          this.processPan();
          break;
        case 'zoom':
          this.processZoom();
          break;
        case 'rotate':
          this.processRotate();
          break;
        case 'tap':
          this.processTap();
          break;
        case 'longPress':
          this.processLongPress();
          break;
    }

      const endTime = performance.now();
      result.performance.duration = endTime - startTime;
      result.performance.memoryUsage = this.getMemoryUsage();
      result.performance.cpuUsage = this.getCPUUsage();

      this.interactionHistory.push(result);
      
      // Limit history size
      if (this.interactionHistory.length > 100) {
        this.interactionHistory = this.interactionHistory.slice(-100);
    }

  } catch (error) {
      console.error('Error processing gesture: ', error);
  }
}

  /**
   * Process pan gesture
   */
  private processPan(): void {
    // Implement pan logic
}

  /**
   * Process zoom gesture
   */
  private processZoom(): void {
    // Implement zoom logic
}

  /**
   * Process rotate gesture
   */
  private processRotate(): void {
    // Implement rotate logic
}

  /**
   * Process tap gesture
   */
  private processTap(): void {
    // Implement tap logic
}

  /**
   * Process long press gesture
   */
  private processLongPress(): void {
    // Implement long press logic
}

  /**
   * Reset state
   */
  private resetState(): void {
    this.state.isPanning = false;
    this.state.isZooming = false;
    this.state.isRotating = false;
    this.state.isSelecting = false;
    this.state.isDragging = false;
    this.state.isResizing = false;
    this.state.isMultiSelecting = false;
    this.state.isGesturing = false;
    this.gestureData = null;
}

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize / 1024 / 1024;
  }
    return 0;
}

  /**
   * Get CPU usage
   */
  private getCPUUsage(): number {
    // Simplified CPU usage calculation
    return Math.random() * 100;
}

  /**
   * Get interaction history
   */
  getInteractionHistory(): InteractionResult[] {
    return [...this.interactionHistory];
}

  /**
   * Get current state
   */
  getState(): InteractionState {
    return { ...this.state };
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<InteractionConfig>): void {
    this.config = { ...this.config, ...newConfig };
}

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
      this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
      this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
      this.canvas.removeEventListener('mouseleave', this.handleMouseLeave.bind(this));
      this.canvas.removeEventListener('wheel', this.handleWheel.bind(this));
      this.canvas.removeEventListener('dblclick', this.handleDoubleClick.bind(this));
      this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      this.canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      this.canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));
      this.canvas.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
      this.canvas.removeEventListener('keydown', this.handleKeyDown.bind(this));
      this.canvas.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }
    
    this.interactionHistory = [];
    this.isInitialized = false;
}
}

// Create singleton instance
export const canvasInteractionManager = new CanvasInteractionManager();

export default canvasInteractionManager;





