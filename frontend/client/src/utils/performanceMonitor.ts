/**
 * Performance Monitoring and Metrics Collection
 * Comprehensive performance monitoring and analytics
 */

export interface PerformanceConfig {
  enableMonitoring: boolean;
  enableMetrics: boolean;
  enableProfiling: boolean;
  enableUserTiming: boolean;
  enableResourceTiming: boolean;
  enableNavigationTiming: boolean;
  enablePaintTiming: boolean;
  enableLayoutTiming: boolean;
  monitoringInterval: number; // in ms
  maxMetricsHistory: number;
  enableRealUserMonitoring: boolean;
  enableSyntheticMonitoring: boolean
}

export interface PerformanceMetrics {
  timestamp: number;
  navigation: {
    loadTime: number;
    domContentLoaded: number;
    firstPaint: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    firstInputDelay: number;
    cumulativeLayoutShift: number;
};
  resources: {
    totalSize: number;
    totalCount: number;
    averageSize: number;
    loadTime: number;
};
  memory: {
    used: number;
    total: number;
    available: number;
    percentage: number;
};
  rendering: {
    fps: number;
    frameTime: number;
    layoutTime: number;
    paintTime: number;
};
  network: {
    connectionType: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
};
  user: {
    interactions: number;
    clicks: number;
    scrolls: number;
    keypresses: number;
};
}

export interface PerformanceAlert {
  id: string;
  type: 'performance, ' | 'memory' | 'network' | 'rendering';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  component?: string;
  action?: string
}

export interface PerformanceReport {
  summary: {
    overallScore: number;
    performanceScore: number;
    accessibilityScore: number;
    bestPracticesScore: number;
    seoScore: number;
};
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  recommendations: Array<{
    type: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    action: string;
}>;
  trends: {
    loadTime: number[];
    memoryUsage: number[];
    fps: number[];
};
}

class PerformanceMonitor {
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private frameCount = 0;
  private lastFrameTime = 0;
  private fps = 0;
  private interactionCount = 0;
  private clickCount = 0;
  private scrollCount = 0;
  private keypressCount = 0;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enableMonitoring: true,
      enableMetrics: true,
      enableProfiling: true,
      enableUserTiming: true,
      enableResourceTiming: true,
      enableNavigationTiming: true,
      enablePaintTiming: true,
      enableLayoutTiming: true,
      monitoringInterval: 500, // 5 seconds
      maxMetricsHistory: 10,
      enableRealUserMonitoring: true,
      enableSyntheticMonitoring: true,
      ...config
  };

    this.initializePerformanceMonitor();
}

  /**
   * Initialize performance monitor
   */
  private initializePerformanceMonitor(): void {
    if (this.config.enableMonitoring) {
      this.startMonitoring();
  }

    if (this.config.enableUserTiming) {
      this.setupUserTiming();
  }

    if (this.config.enableRealUserMonitoring) {
      this.setupRealUserMonitoring();
  }

    if (this.config.enableSyntheticMonitoring) {
      this.setupSyntheticMonitoring();
  }
}

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
      this.checkAlerts();
  }, this.config.monitoringInterval);
}

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
  }
    this.isMonitoring = false;
}

  /**
   * Collect performance metrics
   */
  private collectMetrics(): void {
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      navigation: this.getNavigationTiming(),
      resources: this.getResourceTiming(),
      memory: this.getMemoryTiming(),
      rendering: this.getRenderingTiming(),
      network: this.getNetworkTiming(),
      user: {
        interactions: this.interactionCount,
        clicks: this.clickCount,
        scrolls: this.scrollCount,
        keypresses: this.keypressCount
  }
  };

    this.metrics.push(metrics);

    // Keep only last N measurements
    if (this.metrics.length > this.config.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.config.maxMetricsHistory);
  }
}

  /**
   * Get navigation timing metrics
   */
  private getNavigationTiming(): any {
    if (!this.config.enableNavigationTiming) return {};

    const navigation = performance.getEntriesByType('navigation, ')[0] as PerformanceNavigationTiming;
    if (!navigation) return {};

    return {
      loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      firstPaint: this.getFirstPaint(),
      firstContentfulPaint: this.getFirstContentfulPaint(),
      largestContentfulPaint: this.getLargestContentfulPaint(),
      firstInputDelay: this.getFirstInputDelay(),
      cumulativeLayoutShift: this.getCumulativeLayoutShift()
};
}

  /**
   * Get first paint timing
   */
  private getFirstPaint(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : 0;
}

  /**
   * Get first contentful paint timing
   */
  private getFirstContentfulPaint(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint ? firstContentfulPaint.startTime : 0;
}

  /**
   * Get largest contentful paint timing
   */
  private getLargestContentfulPaint(): number {
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    const lcp = lcpEntries[lcpEntries.length - 1];
    return lcp ? lcp.startTime : 0;
}

  /**
   * Get first input delay
   */
  private getFirstInputDelay(): number {
    const fidEntries = performance.getEntriesByType('first-input');
    const fid = fidEntries[0] as any;
    return fid ? fid.processingStart - fid.startTime : 0;
}

  /**
   * Get cumulative layout shift
   */
  private getCumulativeLayoutShift(): number {
    const clsEntries = performance.getEntriesByType('layout-shift');
    return clsEntries.reduce((sum, entry: any) => sum + entry.value, 0);
}

  /**
   * Get resource timing metrics
   */
  private getResourceTiming(): any {
    if (!this.config.enableResourceTiming) return {};

    const resources = performance.getEntriesByType('resource');
    const totalSize = resources.reduce((sum, resource: any) => sum + (resource.transferSize || 0), 0);
    const totalCount = resources.length;
    const averageSize = totalCount > 0 ? totalSize / totalCount : 0;
    const loadTime = resources.reduce((sum, resource: any) => sum + (resource.duration || 0), 0);

    return {
      totalSize,
      totalCount,
      averageSize,
      loadTime
  };
}

  /**
   * Get memory timing metrics
   */
  private getMemoryTiming(): any {
    const memory = (performance as any).memory;
    if (!memory) return {};

    return {
      used: memory.usedJSHeapSize / 1024 / 104, // Convert to MB
      total: memory.totalJSHeapSize / 1024 / 104,
      available: (memory.jsHeapSizeLimit - memory.usedJSHeapSize) / 1024 / 104,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
};
}

  /**
   * Get rendering timing metrics
   */
  private getRenderingTiming(): any {
    return {
      fps: this.fps,
      frameTime: this.lastFrameTime,
      layoutTime: this.getLayoutTime(),
      paintTime: this.getPaintTime()
};
}

  /**
   * Get layout time
   */
  private getLayoutTime(): number {
    const layoutEntries = performance.getEntriesByType('measure');
    const layoutEntry = layoutEntries.find(entry => entry.name === 'layout');
    return layoutEntry ? layoutEntry.duration : 0;
}

  /**
   * Get paint time
   */
  private getPaintTime(): number {
    const paintEntries = performance.getEntriesByType('paint');
    return paintEntries.reduce((sum, entry) => sum + entry.duration, 0);
}

  /**
   * Get network timing metrics
   */
  private getNetworkTiming(): any {
    const connection = (navigator as any).connection;
    if (!connection) return {};

    return {
      connectionType: connection.type || 'unknown',
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0
};
}

  /**
   * Setup user timing
   */
  private setupUserTiming(): void {
    // Mark page load start
    performance.mark('page-load-start');

    // Mark page load end
    window.addEventListener('load', () => {
      performance.mark('page-load-end');
      performance.measure('page-load', 'page-load-start','page-load-end');
  });
}

  /**
   * Setup real user monitoring
   */
  private setupRealUserMonitoring(): void {
    // Track user interactions
    document.addEventListener('click', () => {
      this.clickCount++;
      this.interactionCount++;
  });

    document.addEventListener('scroll', () => {
      this.scrollCount++;
      this.interactionCount++;
  });

    document.addEventListener('keypress', () => {
      this.keypressCount++;
      this.interactionCount++;
  });

    // Track FPS
    this.trackFPS();
}

  /**
   * Track FPS
   */
  private trackFPS(): void {
    const trackFrame = (timestamp: number) => {
      if (this.lastFrameTime) {
        const deltaTime = timestamp - this.lastFrameTime;
        this.frameCount++;
        
        if (this.frameCount >= 60) {
          this.fps = Math.round(1000 / (deltaTime / this.frameCount));
          this.frameCount = 0;
    }
    }
      
      this.lastFrameTime = timestamp;
      requestAnimationFrame(trackFrame);
  };
    
    requestAnimationFrame(trackFrame);
}

  /**
   * Setup synthetic monitoring
   */
  private setupSyntheticMonitoring(): void {
    // Monitor page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        performance.mark('page-hidden');
    } else {
        performance.mark('page-visible');
    }
  });

    // Monitor beforeunload
    window.addEventListener('beforeunload', () => {
      performance.mark('page-unload');
  });
}

  /**
   * Analyze performance
   */
  private analyzePerformance(): void {
    const currentMetrics = this.metrics[this.metrics.length - 1];
    if (!currentMetrics) return;

    // Analyze load time
    if (currentMetrics.navigation.loadTime > 3000) {
      this.createAlert('performance','high','Slow page load time', currentMetrics.navigation.loadTime, 3000);
  }

    // Analyze memory usage
    if (currentMetrics.memory.percentage > 80) {
      this.createAlert('memory','high','High memory usage', currentMetrics.memory.percentage, 80);
  }

    // Analyze FPS
    if (currentMetrics.rendering.fps < 30) {
      this.createAlert('rendering','medium','Low FPS', currentMetrics.rendering.fps, 30);
  }

    // Analyze resource size
    if (currentMetrics.resources.totalSize > 5 * 1024 * 1024) { // 5MB
      this.createAlert('performance','medium', 'Large resource size', currentMetrics.resources.totalSize, 5 * 1024 * 1024);
  }
}

  /**
   * Create performance alert
   */
  private createAlert(type: string, severity: string, message: string, value: number, threshold: number): void {
    const alert: PerformanceAlert = {
      id: `${type}-${Date.now()}`,
      type: type as any,
      severity: severity as any,
      message,
      value,
      threshold,
      timestamp: Date.now()
};

    this.alerts.push(alert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
  }
}

  /**
   * Check performance alerts
   */
  private checkAlerts(): void {
    // Check for critical alerts
    const criticalAlerts = this.alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      console.error('Critical performance alerts: ', criticalAlerts);
  }

    // Check for high severity alerts
    const highAlerts = this.alerts.filter(alert => alert.severity === 'high');
    if (highAlerts.length > 0) {
      console.warn('High severity performance alerts:', highAlerts);
  }
}

  /**
   * Get performance report
   */
  getPerformanceReport(): PerformanceReport {
    const currentMetrics = this.metrics[this.metrics.length - 1];
    if (!currentMetrics) {
      return {
        summary: {
          overallScore: 0,
          performanceScore: 0,
          accessibilityScore: 0,
          bestPracticesScore: 0,
          seoScore: 0
    },
        metrics: {} as PerformanceMetrics,
        alerts: [],
        recommendations: [],
        trends: {
          loadTime: [],
          memoryUsage: [],
          fps: []
    }
    };
  }

    const summary = this.calculatePerformanceScore(currentMetrics);
    const recommendations = this.generateRecommendations(currentMetrics);
    const trends = this.calculateTrends();

    return {
      summary,
      metrics: currentMetrics,
      alerts: this.alerts,
      recommendations,
      trends
  };
}

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(metrics: PerformanceMetrics): any {
    let performanceScore = 100;
    let accessibilityScore = 100;
    let bestPracticesScore = 100;
    const seoScore = 100;

    // Performance score based on load time
    if (metrics.navigation.loadTime > 3000) {
      performanceScore -= 20;
} else if (metrics.navigation.loadTime > 2000) {
      performanceScore -= 10;
  }

    // Performance score based on FPS
    if (metrics.rendering.fps < 30) {
      performanceScore -= 15;
  } else if (metrics.rendering.fps < 45) {
      performanceScore -= 5;
  }

    // Performance score based on memory usage
    if (metrics.memory.percentage > 80) {
      performanceScore -= 10;
  }

    // Accessibility score based on layout shift
    if (metrics.navigation.cumulativeLayoutShift > 0.25) {
      accessibilityScore -= 20;
  }

    // Best practices score based on resource size
    if (metrics.resources.totalSize > 5 * 1024 * 1024) {
      bestPracticesScore -= 15;
  }

    const overallScore = Math.round((performanceScore + accessibilityScore + bestPracticesScore + seoScore) / 4);

    return {
      overallScore,
      performanceScore: Math.max(0, performanceScore),
      accessibilityScore: Math.max(0, accessibilityScore),
      bestPracticesScore: Math.max(0, bestPracticesScore),
      seoScore: Math.max(0, seoScore)
  };
}

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: PerformanceMetrics): Array<any> {
    const recommendations: Array<any> = [];

    // Load time recommendations
    if (metrics.navigation.loadTime > 3000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        description: 'Page load time is slow',
        impact: 'High',
        effort: 'medium',
        action: 'Optimize images, enable compression, use CDN'
    });
  }

    // Memory recommendations
    if (metrics.memory.percentage > 80) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        description: 'High memory usage',
        impact: 'High',
        effort: 'high',
        action: 'Implement memory optimization, reduce object creation'
    });
  }

    // FPS recommendations
    if (metrics.rendering.fps < 30) {
      recommendations.push({
        type: 'rendering',
        priority: 'medium',
        description: 'Low FPS detected',
        impact: 'Medium',
        effort: 'medium',
        action: 'Optimize animations, reduce DOM complexity'
    });
  }

    // Resource size recommendations
    if (metrics.resources.totalSize > 5 * 1024 * 1024) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        description: 'Large resource size',
        impact: 'Medium',
        effort: 'low',
        action:'Compress images, minify CSS/JS, use lazy loading'
    });
  }

    return recommendations;
}

  /**
   * Calculate performance trends
   */
  private calculateTrends(): any {
    const loadTimes = this.metrics.map(m => m.navigation.loadTime).filter(t => t > 0);
    const memoryUsage = this.metrics.map(m => m.memory.percentage);
    const fps = this.metrics.map(m => m.rendering.fps).filter(f => f > 0);

    return {
      loadTime: loadTimes.slice(-20), // Last 20 measurements
      memoryUsage: memoryUsage.slice(-20),
      fps: fps.slice(-20)
};
}

  /**
   * Get current metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
}

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
}

  /**
   * Get performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
}

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.metrics = [];
    this.alerts = [];
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
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
    this.metrics = [];
    this.alerts = [];
}
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions
export const getPerformanceReport = () => {
  return performanceMonitor.getPerformanceReport();
};

export const getCurrentMetrics = () => {
  return performanceMonitor.getCurrentMetrics();
};

export const getMetricsHistory = () => {
  return performanceMonitor.getMetricsHistory();
};

export const getAlerts = () => {
  return performanceMonitor.getAlerts();
};

export const startPerformanceMonitoring = () => {
  performanceMonitor.startMonitoring();
};

export const stopPerformanceMonitoring = () => {
  performanceMonitor.stopMonitoring();
};

export default performanceMonitor;


