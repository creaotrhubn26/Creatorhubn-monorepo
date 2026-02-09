/**
 * Memory Optimization Utilities
 * Memory usage monitoring and optimization features
 */

export interface MemoryConfig {
  enableMonitoring: boolean;
  enableGarbageCollection: boolean;
  enableMemoryLeakDetection: boolean;
  enableOptimization: boolean;
  maxMemoryUsage: number; // in MB
  gcThreshold: number; // in MB
  monitoringInterval: number; // in ms
  leakDetectionThreshold: number; // in M
}

export interface MemoryStats {
  used: number;
  total: number;
  available: number;
  percentage: number;
  timestamp: number;
  heap: {
    used: number;
    total: number;
    limit: number;
};
  objects: {
    count: number;
    size: number;
};
  leaks: Array<{
    type: string;
    size: number;
    location: string;
    timestamp: number;
}>;
}

export interface MemoryLeak {
  id: string;
  type: 'eventListener, ' | 'timer, ' | 'closure' | 'dom' | 'cache' | 'unknown';
  size: number;
  location: string;
  timestamp: number;
  stackTrace: string;
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface OptimizationSuggestion {
  type: 'cleanup' | 'optimization' | 'refactor' | 'garbageCollection';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  action: string;
  estimatedSavings: number; // in M
}

class MemoryOptimizer {
  private config: MemoryConfig;
  private memoryStats: MemoryStats[] = [];
  private memoryLeaks: MemoryLeak[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Array<{ element: EventTarget; event: string; handler: Function }>> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private domReferences: Map<string, HTMLElement> = new Map();
  private cacheReferences: Map<string, any> = new Map();
  private isMonitoring = false;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = {
      enableMonitoring: true,
      enableGarbageCollection: true,
      enableMemoryLeakDetection: true,
      enableOptimization: true,
      maxMemoryUsage: 10, // 100MB
      gcThreshold:  80, // 80MB
      monitoringInterval: 500, // 5 seconds
      leakDetectionThreshold:  10, // 10MB
      ...config
  };

    this.initializeMemoryOptimizer();
}

  /**
   * Initialize memory optimizer
   */
  private initializeMemoryOptimizer(): void {
    if (this.config.enableMonitoring) {
      this.startMonitoring();
  }

    if (this.config.enableMemoryLeakDetection) {
      this.setupLeakDetection();
  }

    if (this.config.enableOptimization) {
      this.setupOptimization();
  }
}

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMemoryStats();
      this.detectMemoryLeaks();
      this.optimizeMemory();
  }, this.config.monitoringInterval);
}

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
  }
    this.isMonitoring = false;
}

  /**
   * Collect memory statistics
   */
  private collectMemoryStats(): void {
    const memory = (performance as any).memory;
    if (!memory) return;

    const stats: MemoryStats = {
      used: memory.usedJSHeapSize / 1024 / 104, // Convert to MB
      total: memory.totalJSHeapSize / 1024 / 104,
      available: (memory.jsHeapSizeLimit - memory.usedJSHeapSize) / 1024 / 104,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 10,
      timestamp: Date.now(),
      heap: {
        used: memory.usedJSHeapSize / 1024 / 104,
        total: memory.totalJSHeapSize / 1024 / 104,
        limit: memory.jsHeapSizeLimit / 1024 / 1024
  },
      objects: {
        count: this.countObjects(),
        size: this.estimateObjectSize()
  },
      leaks: this.memoryLeaks
};

    this.memoryStats.push(stats);

    // Keep only last 100 measurements
    if (this.memoryStats.length > 100) {
      this.memoryStats = this.memoryStats.slice(-100);
  }
}

  /**
   * Count objects in memory
   */
  private countObjects(): number {
    let count = 0;
    const objects = new Set();

    // Count DOM elements
    count += document.querySelectorAll('*, ').length;

    // Count event listeners
    for (const listeners of this.eventListeners.values()) {
      count += listeners.length;
  }

    // Count timers
    count += this.timers.size;

    // Count DOM references
    count += this.domReferences.size;

    // Count cache references
    count += this.cacheReferences.size;

    return count;
}

  /**
   * Estimate object size
   */
  private estimateObjectSize(): number {
    let size = 0;

    // Estimate DOM size
    size += document.querySelectorAll('*').length * 0.1; // Rough estimate

    // Estimate event listener size
    for (const listeners of this.eventListeners.values()) {
      size += listeners.length * 0.05;
  }

    // Estimate timer size
    size += this.timers.size * 0.01;

    // Estimate DOM reference size
    size += this.domReferences.size * 0.1;

    // Estimate cache reference size
    size += this.cacheReferences.size * 0.2;

    return size;
}

  /**
   * Setup memory leak detection
   */
  private setupLeakDetection(): void {
    // Monitor event listeners
    this.monitorEventListeners();

    // Monitor timers
    this.monitorTimers();

    // Monitor DOM references
    this.monitorDOMReferences();

    // Monitor cache references
    this.monitorCacheReferences();
}

  /**
   * Monitor event listeners
   */
  private monitorEventListeners(): void {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

    EventTarget.prototype.addEventListener = function(type: string, listener: Function, options?: any) {
      const id = `${this.constructor.name}-${type}`;
      if (!this.eventListeners.has(id)) {
        this.eventListeners.set(id, []);
    }
      this.eventListeners.get(id)!.push({ element: this, event: type, handler: listener });
      return originalAddEventListener.call(this, type, listener, options);
  };

    EventTarget.prototype.removeEventListener = function(type: string, listener: Function, options?: any) {
      const id = `${this.constructor.name}-${type}`;
      if (this.eventListeners.has(id)) {
        const listeners = this.eventListeners.get(id)!;
        const index = listeners.findIndex(l => l.handler === listener);
        if (index > -1) {
          listeners.splice(index, 1);
      }
    }
      return originalRemoveEventListener.call(this, type, listener, options);
  };
}

  /**
   * Monitor timers
   */
  private monitorTimers(): void {
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    const originalClearTimeout = window.clearTimeout;
    const originalClearInterval = window.clearInterval;

    window.setTimeout = (handler: Function, timeout?: number, ...args: any[]) => {
      const id = originalSetTimeout(handler, timeout, ...args);
      this.timers.set(`timeout-${id}`, id as any);
      return id;
  };

    window.setInterval = (handler: Function, timeout?: number, ...args: any[]) => {
      const id = originalSetInterval(handler, timeout, ...args);
      this.timers.set(`interval-${id}`, id as any);
      return id;
  };

    window.clearTimeout = (id: number) => {
      this.timers.delete(`timeout-${d}`);
      return originalClearTimeout(id);
  };

    window.clearInterval = (id: number) => {
      this.timers.delete(`interval-${d}`);
      return originalClearInterval(id);
  };
}

  /**
   * Monitor DOM references
   */
  private monitorDOMReferences(): void {
    // Track DOM element references
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              this.domReferences.set(element.id || `element-${Date.now()}`, element);
          }
        });
      }
    });
  });

    observer.observe(document.body, {
      childList: true,
      subtree: true
});
}

  /**
   * Monitor cache references
   */
  private monitorCacheReferences(): void {
    // Monitor cache usage
    setInterval(() => {
      const cacheSize = this.cacheReferences.size;
      if (cacheSize > 1000) { // Threshold for cache size
        this.detectCacheLeak();
    }
  }, 10000); // Check every 10 seconds
}

  /**
   * Detect memory leaks
   */
  private detectMemoryLeaks(): void {
    const currentStats = this.memoryStats[this.memoryStats.length - 1];
    if (!currentStats) return;

    // Check for memory growth
    if (this.memoryStats.length >= 5) {
      const recentStats = this.memoryStats.slice(-5);
      const growth = recentStats[recentStats.length - 1].used - recentStats[0].used;
      
      if (growth > this.config.leakDetectionThreshold) {
        this.reportMemoryLeak('memory_growth', growth, 'Memory usage growing rapidly');
    }
  }

    // Check for event listener leaks
    this.detectEventListenerLeaks();

    // Check for timer leaks
    this.detectTimerLeaks();

    // Check for DOM reference leaks
    this.detectDOMReferenceLeaks();

    // Check for cache leaks
    this.detectCacheLeaks();
}

  /**
   * Detect event listener leaks
   */
  private detectEventListenerLeaks(): void {
    for (const [id, listeners] of this.eventListeners.entries()) {
      if (listeners.length > 100) { // Threshold for event listeners
        this.reportMemoryLeak('event_listener', listeners.length, `Too many event listeners for ${id}`);
    }
  }
}

  /**
   * Detect timer leaks
   */
  private detectTimerLeaks(): void {
    if (this.timers.size > 50) { // Threshold for timers
      this.reportMemoryLeak('timer', this.timers.size, 'Too many active timers');
  }
}

  /**
   * Detect DOM reference leaks
   */
  private detectDOMReferenceLeaks(): void {
    if (this.domReferences.size > 1000) { // Threshold for DOM references
      this.reportMemoryLeak('dom_reference', this.domReferences.size, 'Too many DOM references');
  }
}

  /**
   * Detect cache leaks
   */
  private detectCacheLeaks(): void {
    if (this.cacheReferences.size > 500) { // Threshold for cache references
      this.reportMemoryLeak('cache', this.cacheReferences.size, 'Too many cache references');
  }
}

  /**
   * Report memory leak
   */
  private reportMemoryLeak(type: string, size: number, description: string): void {
    const leak: MemoryLeak = {
      id: `${type}-${Date.now()}`,
      type: type as any,
      size,
      location: description,
      timestamp: Date.now(),
      stackTrace: new Error().stack ||', ',
      severity: size > 100 ? 'critical' : size > 50 ? 'high' : size > 20 ? 'medium' : 'low'
};

    this.memoryLeaks.push(leak);

    // Keep only last 50 leaks
    if (this.memoryLeaks.length > 50) {
      this.memoryLeaks = this.memoryLeaks.slice(-50);
  }

    console.warn('Memory leak detected: ', leak);
}

  /**
   * Setup optimization
   */
  private setupOptimization(): void {
    // Setup automatic garbage collection
    if (this.config.enableGarbageCollection) {
      this.setupGarbageCollection();
  }

    // Setup memory cleanup
    this.setupMemoryCleanup();
}

  /**
   * Setup garbage collection
   */
  private setupGarbageCollection(): void {
    setInterval(() => {
      const currentStats = this.memoryStats[this.memoryStats.length - 1];
      if (currentStats && currentStats.used > this.config.gcThreshold) {
        this.forceGarbageCollection();
    }
  }, 30000); // Check every 30 seconds
}

  /**
   * Force garbage collection
   */
  private forceGarbageCollection(): void {
    if (window.gc) {
      window.gc();
  } else {
      // Fallback: try to trigger GC by creating and releasing objects
      const temp = new Array(1000000).fill(0);
      temp.length = 0;
}
}

  /**
   * Setup memory cleanup
   */
  private setupMemoryCleanup(): void {
    // Clean up old memory stats
    setInterval(() => {
      if (this.memoryStats.length > 100) {
        this.memoryStats = this.memoryStats.slice(-50);
    }
  }, 60000); // Clean up every minute

    // Clean up old memory leaks
    setInterval(() => {
      if (this.memoryLeaks.length > 50) {
        this.memoryLeaks = this.memoryLeaks.slice(-25);
    }
  }, 60000); // Clean up every minute
}

  /**
   * Optimize memory
   */
  private optimizeMemory(): void {
    const currentStats = this.memoryStats[this.memoryStats.length - 1];
    if (!currentStats) return;

    // Check if memory usage is high
    if (currentStats.used > this.config.maxMemoryUsage) {
      this.performMemoryOptimization();
  }
}

  /**
   * Perform memory optimization
   */
  private performMemoryOptimization(): void {
    // Clear unused event listeners
    this.clearUnusedEventListeners();

    // Clear unused timers
    this.clearUnusedTimers();

    // Clear unused DOM references
    this.clearUnusedDOMReferences();

    // Clear unused cache references
    this.clearUnusedCacheReferences();

    // Force garbage collection
    this.forceGarbageCollection();
}

  /**
   * Clear unused event listeners
   */
  private clearUnusedEventListeners(): void {
    for (const [id, listeners] of this.eventListeners.entries()) {
      const activeListeners = listeners.filter(l => {
        try {
          return l.element && l.element.addEventListener;
      } catch {
          return false;
      }
    });
      
      if (activeListeners.length !== listeners.length) {
        this.eventListeners.set(id, activeListeners);
    }
  }
}

  /**
   * Clear unused timers
   */
  private clearUnusedTimers(): void {
    for (const [id, timer] of this.timers.entries()) {
      try {
        if (id.startsWith('timeout-')) {
          clearTimeout(timer);
      } else if (id.startsWith('interval-')) {
          clearInterval(timer);
      }
        this.timers.delete(id);
    } catch {
        // Timer already cleared
        this.timers.delete(id);
    }
  }
}

  /**
   * Clear unused DOM references
   */
  private clearUnusedDOMReferences(): void {
    for (const [id, element] of this.domReferences.entries()) {
      if (!document.contains(element)) {
        this.domReferences.delete(id);
    }
  }
}

  /**
   * Clear unused cache references
   */
  private clearUnusedCacheReferences(): void {
    // Clear cache references older than 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [id, reference] of this.cacheReferences.entries()) {
      if (reference.timestamp && reference.timestamp < fiveMinutesAgo) {
        this.cacheReferences.delete(id);
    }
  }
}

  /**
   * Get memory statistics
   */
  getMemoryStats(): MemoryStats | null {
    return this.memoryStats[this.memoryStats.length - 1] || null;
}

  /**
   * Get memory history
   */
  getMemoryHistory(): MemoryStats[] {
    return [...this.memoryStats];
}

  /**
   * Get memory leaks
   */
  getMemoryLeaks(): MemoryLeak[] {
    return [...this.memoryLeaks];
}

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const currentStats = this.getMemoryStats();
    
    if (!currentStats) return suggestions;

    // High memory usage suggestion
    if (currentStats.percentage > 80) {
      suggestions.push({
        type: 'garbageCollection',
        priority: 'high',
        description: 'Memory usage is above 80, %',
        impact: 'High',
        effort: 'low',
        action: 'Force garbage collection',
        estimatedSavings: currentStats.used * 0.2
  });
  }

    // Event listener leak suggestion
    if (this.eventListeners.size > 50) {
      suggestions.push({
        type: 'cleanup',
        priority: 'medium',
        description: 'Too many event listeners',
        impact: 'Medium',
        effort: 'medium',
        action: 'Clean up unused event listeners',
        estimatedSavings: this.eventListeners.size * 0.05
  });
  }

    // Timer leak suggestion
    if (this.timers.size > 20) {
      suggestions.push({
        type: 'cleanup',
        priority: 'medium',
        description: 'Too many active timers',
        impact: 'Medium',
        effort: 'low',
        action: 'Clear unused timers',
        estimatedSavings: this.timers.size * 0.01
  });
  }

    // DOM reference leak suggestion
    if (this.domReferences.size > 500) {
      suggestions.push({
        type: 'cleanup',
        priority: 'high',
        description: 'Too many DOM references',
        impact: 'High',
        effort: 'high',
        action:'Clear unused DOM references',
        estimatedSavings: this.domReferences.size * 0.1
  });
  }

    return suggestions;
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.enableMonitoring !== undefined) {
      if (newConfig.enableMonitoring) {
        this.startMonitoring();
    } else {
        this.stopMonitoring();
    }
  }
}

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopMonitoring();
    this.eventListeners.clear();
    this.timers.clear();
    this.domReferences.clear();
    this.cacheReferences.clear();
    this.memoryStats = [];
    this.memoryLeaks = [];
}
}

// Create singleton instance
export const memoryOptimizer = new MemoryOptimizer();

// Utility functions
export const getMemoryStats = () => {
  return memoryOptimizer.getMemoryStats();
};

export const getMemoryHistory = () => {
  return memoryOptimizer.getMemoryHistory();
};

export const getMemoryLeaks = () => {
  return memoryOptimizer.getMemoryLeaks();
};

export const getOptimizationSuggestions = () => {
  return memoryOptimizer.getOptimizationSuggestions();
};

export const startMemoryMonitoring = () => {
  memoryOptimizer.startMonitoring();
};

export const stopMemoryMonitoring = () => {
  memoryOptimizer.stopMonitoring();
};

export default memoryOptimizer;





