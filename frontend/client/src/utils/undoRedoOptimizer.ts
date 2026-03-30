/**
 * Undo/Redo System Optimization
 * Efficient state management for undo/redo functionality
 */

export interface UndoRedoConfig {
  maxHistorySize: number;
  enableCompression: boolean;
  enableDifferentialUpdates: boolean;
  enableMemoryOptimization: boolean;
  enablePerformanceMonitoring: boolean;
  compressionThreshold: number; // in bytes
  memoryThreshold: number; // in MB
  performanceThreshold: number; // in ms
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  data: any;
  compressed: boolean;
  size: number;
  checksum: string;
  metadata: {
    component: string;
    userId?: string;
    sessionId?: string;
    description?: string;
};
}

export interface UndoRedoState {
  history: HistoryEntry[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  isPerformingAction: boolean;
  memoryUsage: number;
  performanceMetrics: {
    averageActionTime: number;
    totalActions: number;
    compressionRatio: number;
};
}

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  performance: {
    executionTime: number;
    memoryDelta: number;
    compressed: boolean;
};
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  ratio: number;
  algorithm: string;
  time: number;
  compressed: boolean;
  data: unknown;
}

interface PerformanceMemoryInfo {
  usedJSHeapSize: number;
}

type PerformanceWithMemory = Performance & {
  memory?: PerformanceMemoryInfo;
};

class UndoRedoOptimizer {
  private config: UndoRedoConfig;
  private state: UndoRedoState;
  private actionQueue: Array<() => Promise<ActionResult>> = [];
  private isProcessingQueue = false;
  private performanceHistory: number[] = [];
  private memoryHistory: number[] = [];

  constructor(config: Partial<UndoRedoConfig> = {}) {
    this.config = {
      maxHistorySize: 10,
      enableCompression: true,
      enableDifferentialUpdates: true,
      enableMemoryOptimization: true,
      enablePerformanceMonitoring: true,
      compressionThreshold: 104, // 1KB
      memoryThreshold: 50, // 50MB
      performanceThreshold: 10, // 100ms
      ...config
  };

    this.state = {
      history: [],
      currentIndex: -1,
      canUndo: false,
      canRedo: false,
      isPerformingAction: false,
      memoryUsage: 0,
      performanceMetrics: {
        averageActionTime: 0,
        totalActions: 0,
        compressionRatio: 0
  }
  };

    this.initializeOptimizer();
}

  /**
   * Initialize optimizer
   */
  private initializeOptimizer(): void {
    if (this.config.enablePerformanceMonitoring) {
      this.setupPerformanceMonitoring();
  }

    if (this.config.enableMemoryOptimization) {
      this.setupMemoryOptimization();
  }
}

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Monitor performance metrics
    setInterval(() => {
      this.updatePerformanceMetrics();
  }, 1000);
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
   * Add action to history
   */
  async addAction(
    action: string,
    data: any,
    metadata: Partial<HistoryEntry['metadata']> = {}
  ): Promise<ActionResult> {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      // Compress data if needed
      const compressionResult = await this.compressData(data);
      const compressedData = compressionResult.compressed ? compressionResult.data : data;

      // Create history entry
      const entry: HistoryEntry = {
        id: this.generateId(),
        timestamp: Date.now(),
        action,
        data: compressedData,
        compressed: compressionResult.compressed,
        size: compressionResult.compressed ? compressionResult.compressedSize : compressionResult.originalSize,
        checksum: this.calculateChecksum(compressedData),
        metadata: {
          component: 'unknown',
          ...metadata
        }
      };

      // Add to history
      this.addToHistory(entry);

      // Update state
      this.updateState();

      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      const result: ActionResult = {
        success: true,
        data: compressedData,
        performance: {
          executionTime: endTime - startTime,
          memoryDelta: endMemory - startMemory,
          compressed: compressionResult.compressed
    }
    };

      // Update performance metrics
      this.updatePerformanceMetrics(result.performance.executionTime);

      return result;
  } catch (error) {
      const endTime = performance.now();
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        performance: {
          executionTime: endTime - startTime,
          memoryDelta:  0,
          compressed: false
    }
    };
  }
}

  /**
   * Undo last action
   */
  async undo(): Promise<ActionResult> {
    if (!this.state.canUndo) {
      return {
        success: false,
        error: 'No actions to undo',
        performance: { executionTime: 0, memoryDelta: 0, compressed: false }
    };
  }

    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      const entry = this.state.history[this.state.currentIndex];
      
      // Decompress data if needed
      const data = entry.compressed ? await this.decompressData(entry.data) : entry.data;

      // Move to previous index
      this.state.currentIndex--;

      // Update state
      this.updateState();

      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      return {
        success: true,
        data,
        performance: {
          executionTime: endTime - startTime,
          memoryDelta: endMemory - startMemory,
          compressed: entry.compressed
    }
    };
  } catch (error) {
      const endTime = performance.now();
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        performance: {
          executionTime: endTime - startTime,
          memoryDelta:  0,
          compressed: false
    }
    };
  }
}

  /**
   * Redo next action
   */
  async redo(): Promise<ActionResult> {
    if (!this.state.canRedo) {
      return {
        success: false,
        error: 'No actions to redo',
        performance: { executionTime: 0, memoryDelta: 0, compressed: false }
    };
  }

    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      // Move to next index
      this.state.currentIndex++;
      const entry = this.state.history[this.state.currentIndex];

      // Decompress data if needed
      const data = entry.compressed ? await this.decompressData(entry.data) : entry.data;

      // Update state
      this.updateState();

      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      return {
        success: true,
        data,
        performance: {
          executionTime: endTime - startTime,
          memoryDelta: endMemory - startMemory,
          compressed: entry.compressed
    }
    };
  } catch (error) {
      const endTime = performance.now();
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        performance: {
          executionTime: endTime - startTime,
          memoryDelta:  0,
          compressed: false
    }
    };
  }
}

  /**
   * Compress data
   */
  private async compressData(data: any): Promise<CompressionResult> {
    const originalSize = this.calculateSize(data);
    
    if (!this.config.enableCompression || originalSize < this.config.compressionThreshold) {
      return {
        originalSize,
        compressedSize: originalSize,
        ratio:  1,
        algorithm: 'none',
        time:  0,
        compressed: false,
        data
    };
  }

    const startTime = performance.now();
    
    try {
      // Simple compression using JSON stringify and gzip simulation
      const jsonString = JSON.stringify(data);
      const compressed = this.simpleCompress(jsonString);
      
      const endTime = performance.now();
      const compressedSize = compressed.length;
      const ratio = originalSize / compressedSize;

      return {
        originalSize,
        compressedSize,
        ratio,
        algorithm: 'simple',
        time: endTime - startTime,
        compressed: true,
        data: compressed
  };
  } catch (_error) {
      // Fallback to uncompressed
      return {
        originalSize,
        compressedSize: originalSize,
        ratio:  1,
        algorithm: 'none',
        time:  0,
        compressed: false,
        data
    };
  }
}

  /**
   * Decompress data
   */
  private async decompressData(compressedData: any): Promise<any> {
    if (typeof compressedData === 'string' && compressedData.startsWith('compressed:')) {
      try {
        const decompressed = this.simpleDecompress(compressedData.substring('compressed:'.length));
        return JSON.parse(decompressed);
  } catch (error) {
        console.warn('Failed to decompress data:', error);
        return compressedData;
    }
  }
    
    return compressedData;
}

  /**
   * Simple compression (placeholder for real compression)
   */
  private simpleCompress(data: string): string {
    // In a real implementation, use a proper compression library like pako
    return 'compressed:' + btoa(data);
}

  /**
   * Simple decompression (placeholder for real decompression)
   */
  private simpleDecompress(compressedData: string): string {
    // In a real implementation, use a proper decompression library
    return atob(compressedData);
}

  /**
   * Add entry to history
   */
  private addToHistory(entry: HistoryEntry): void {
    // Remove any entries after current index (when branching)
    this.state.history = this.state.history.slice(0, this.state.currentIndex + 1);
    
    // Add new entry
    this.state.history.push(entry);
    
    // Update current index
    this.state.currentIndex = this.state.history.length - 1;
    
    // Trim history if too large
    if (this.state.history.length > this.config.maxHistorySize) {
      this.state.history = this.state.history.slice(-this.config.maxHistorySize);
      this.state.currentIndex = this.state.history.length - 1;
  }
}

  /**
   * Update state
   */
  private updateState(): void {
    this.state.canUndo = this.state.currentIndex >= 0;
    this.state.canRedo = this.state.currentIndex < this.state.history.length - 1;
    this.state.memoryUsage = this.calculateMemoryUsage();
}

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    return this.state.history.reduce((total, entry) => total + entry.size, 0);
}

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    const memory = (performance as PerformanceWithMemory).memory;
    return memory ? memory.usedJSHeapSize / 1024 / 1024 : 0;
}

  /**
   * Calculate data size
   */
  private calculateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimate in bytes
}

  /**
   * Calculate checksum
   */
  private calculateChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
}
    return hash.toString(36);
}

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(executionTime?: number): void {
    if (executionTime !== undefined) {
      this.performanceHistory.push(executionTime);
      
      // Keep only last 100 measurements
      if (this.performanceHistory.length > 100) {
        this.performanceHistory = this.performanceHistory.slice(-100);
    }
      
      // Update average
      this.state.performanceMetrics.averageActionTime = 
        this.performanceHistory.reduce((sum, time) => sum + time, 0) / this.performanceHistory.length;
  }
    
    this.state.performanceMetrics.totalActions = this.state.history.length;
    
    // Calculate compression ratio
    const totalOriginalSize = this.state.history.reduce((sum, entry) => sum + entry.size, 0);
    const totalCompressedSize = this.state.history.reduce((sum, entry) => 
      sum + (entry.compressed ? entry.size : entry.size), 0);
    
    this.state.performanceMetrics.compressionRatio = 
      totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1;
}

  /**
   * Optimize memory
   */
  private optimizeMemory(): void {
    if (!this.config.enableMemoryOptimization) return;
    
    const currentMemory = this.getMemoryUsage();
    this.memoryHistory.push(currentMemory);
    
    // Keep only last 50 measurements
    if (this.memoryHistory.length > 50) {
      this.memoryHistory = this.memoryHistory.slice(-50);
  }
    
    // Check if memory usage is high
    if (currentMemory > this.config.memoryThreshold) {
      this.performMemoryOptimization();
  }
}

  /**
   * Perform memory optimization
   */
  private performMemoryOptimization(): void {
    // Remove old history entries
    if (this.state.history.length > this.config.maxHistorySize / 2) {
      const removeCount = Math.floor(this.state.history.length / 4);
      this.state.history = this.state.history.slice(removeCount);
      this.state.currentIndex = Math.max(0, this.state.currentIndex - removeCount);
  }
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
  }
}

  /**
   * Get current state
   */
  getState(): UndoRedoState {
    return { ...this.state };
}

  /**
   * Get history
   */
  getHistory(): HistoryEntry[] {
    return [...this.state.history];
}

  /**
   * Clear history
   */
  clearHistory(): void {
    this.state.history = [];
    this.state.currentIndex = -1;
    this.state.canUndo = false;
    this.state.canRedo = false;
    this.state.memoryUsage = 0;
}

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return { ...this.state.performanceMetrics };
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<UndoRedoConfig>): void {
    this.config = { ...this.config, ...newConfig };
}

  /**
   * Get configuration
   */
  getConfig(): UndoRedoConfig {
    return { ...this.config };
}

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearHistory();
    this.actionQueue = [];
    this.performanceHistory = [];
    this.memoryHistory = [];
}
}

// Create singleton instance
export const undoRedoOptimizer = new UndoRedoOptimizer();

// Utility functions
export const addAction = (action: string, data: any, metadata?: any) => {
  return undoRedoOptimizer.addAction(action, data, metadata);
};

export const undo = () => {
  return undoRedoOptimizer.undo();
};

export const redo = () => {
  return undoRedoOptimizer.redo();
};

export const getState = () => {
  return undoRedoOptimizer.getState();
};

export const getHistory = () => {
  return undoRedoOptimizer.getHistory();
};

export const clearHistory = () => {
  undoRedoOptimizer.clearHistory();
};

export const getPerformanceMetrics = () => {
  return undoRedoOptimizer.getPerformanceMetrics();
};

export default undoRedoOptimizer;

