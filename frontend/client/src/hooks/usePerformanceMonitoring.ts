// @ts-nocheck
/**
 * Custom hook for Performance Monitoring
 * Tracks performance metrics, memory usage, and provides optimization recommendations
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  cpuUsage: number;
  bundleSize: number;
  loadTime: number;
  networkRequests: number;
  imageOptimization: number;
  codeSplitting: number;
  caching: number;
  compression: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number}

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  memoryUsagePercentage: number}

export interface PerformanceEntry {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  type: 'measure' | 'mark' | 'navigation' | 'resource' | 'paint' | 'layout';
  timestamp: number}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  timestamp: string;
  recommendations: string[]}

export interface OptimizationRecommendation {
  id: string;
  category: 'rendering' | 'memory' | 'network' | 'bundle' | 'caching' | 'images';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  implementation: string;
  estimatedSavings: string}

export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    bundleSize: 0,
    loadTime: 0,
    networkRequests: 0,
    imageOptimization: 0,
    codeSplitting: 0,
    caching: 0,
    compression: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    cumulativeLayoutShift: 0,
    firstInputDelay: 0,
    timeToInteractive: 0
});

  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo>({
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0,
    memoryUsagePercentage: 0
});

  const [performanceEntries, setPerformanceEntries] = useState<PerformanceEntry[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);

  const performanceObserverRef = useRef<PerformanceObserver | null>(null);
  const renderStartTimeRef = useRef<number>(0);

  // Start performance monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);

    // Monitor memory usage
    const memoryInterval = setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const newMemoryInfo: MemoryInfo = {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          memoryUsagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
};
        setMemoryInfo(newMemoryInfo);

        // Check for memory alerts
        if (newMemoryInfo.memoryUsagePercentage > 80) {
          addAlert({
            type: 'warning',
            message: 'High memory usage detected',
            metric: 'memoryUsage',
            value: newMemoryInfo.memoryUsagePercentage,
            threshold: 80,
            recommendations: [
              'Consider implementing memory cleanup', 'Review for memory leaks','Optimize large data structures'
            ]
        });
      }
    }
  }, 1000);

    setMonitoringInterval(memoryInterval);

    // Monitor performance entries
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          const performanceEntry: PerformanceEntry = {
            id: `entry_${Date.now()}_${Math.random()}`,
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
            type: entry.entryType as any,
            timestamp: Date.now()
};
          setPerformanceEntries(prev => [...prev, performanceEntry]);
      });
    });

      observer.observe({ entryTypes: ['measure','mark','navigation','resource','paint','layout'] });
      performanceObserverRef.current = observer;
  }

    // Initial metrics collection
    collectInitialMetrics();
}, [isMonitoring]);

  // Stop performance monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      setMonitoringInterval(null);
  }

    if (performanceObserverRef.current) {
      performanceObserverRef.current.disconnect();
      performanceObserverRef.current = null;
  }
}, [monitoringInterval]);

  // Collect initial performance metrics
  const collectInitialMetrics = useCallback(async () => {
    try {
      // Get navigation timing
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        setMetrics(prev => ({
          ...prev,
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          firstContentfulPaint: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          timeToInteractive: navigation.domInteractive - navigation.navigationStart
}));
    }

      // Get paint timing
      const paintEntries = performance.getEntriesByType('paint');
      paintEntries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          setMetrics(prev => ({ ...prev, firstContentfulPaint: entry.startTime }));
      }
        if (entry.name === 'largest-contentful-paint') {
          setMetrics(prev => ({ ...prev, largestContentfulPaint: entry.startTime }));
      }
    });

      // Get resource timing
      const resourceEntries = performance.getEntriesByType('resource');
      setMetrics(prev => ({ ...prev, networkRequests: resourceEntries.length }));

      // Estimate bundle size (this would be more accurate with webpack stats)
      const scriptTags = document.querySelectorAll('script[src]');
      let totalSize = 0;
      scriptTags.forEach(script => {
        const src = script.getAttribute('src');
        if (src && !src.includes('chrome-extension')) {
          // This is a simplified estimation
          totalSize += 100000; // Assume 100KB per script
      }
    });
      setMetrics(prev => ({ ...prev, bundleSize: totalSize }));

      // Generate recommendations
      generateRecommendations();
  } catch (error) {
      console.error('Failed to collect performance metrics: ', error);
  }
}, []);

  // Measure render time
  const measureRenderTime = useCallback((componentName: string) => {
    const startTime = performance.now();
    renderStartTimeRef.current = startTime;

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      setMetrics(prev => ({ ...prev, renderTime: duration }));
      
      // Mark performance entry
      performance.mark(`${componentName}-render-end`);
      performance.measure(`${componentName}-render`, `${componentName}-render-start`, `${componentName}-render-end`);
      
      // Check for render time alerts
      if (duration > 16) { // More than one frame at 60fps
        addAlert({
          type: 'warning',
          message: `Slow render detected in ${componentName}`,
          metric: 'renderTime',
          value: duration,
          threshold: 16,
          recommendations: [
            'Consider using React.memo for expensive components','Implement useMemo for expensive calculations','Use useCallback for event handlers', 'Consider code splitting for large components'
          ]
      });
    }
  };
}, []);

  // Add performance alert
  const addAlert = useCallback((alert: Omit<PerformanceAlert, 'id' | 'timestamp'>) => {
    const newAlert: PerformanceAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString()
};
    setAlerts(prev => [...prev, newAlert]);
}, []);

  // Generate optimization recommendations
  const generateRecommendations = useCallback(() => {
    const newRecommendations: OptimizationRecommendation[] = [];

    // Memory recommendations
    if (memoryInfo.memoryUsagePercentage > 70) {
      newRecommendations.push({
        id: 'mem-',
        category: 'memory',
        priority: 'high',
        title: 'Optimize Memory Usage',
        description: 'High memory usage detected. Consider implementing memory optimization strategies.',
        impact: 'High',
        effort: 'medium',
        implementation: 'Implement cleanup functions, use WeakMap for caching, optimize data structures',
        estimatedSavings: '20-40% memory reduction'
});
  }

    // Render time recommendations
    if (metrics.renderTime > 16) {
      newRecommendations.push({
        id: 'render-',
        category: 'rendering',
        priority: 'high',
        title: 'Optimize Component Rendering',
        description: 'Slow render times detected. Components are taking longer than 16ms to render.',
        impact: 'High',
        effort: 'medium',
        implementation: 'Use React.memo, useMemo, useCallback, and consider component splitting',
        estimatedSavings: '30-50% render time improvement'
});
  }

    // Bundle size recommendations
    if (metrics.bundleSize > 1000000) { // 1MB
      newRecommendations.push({
        id: 'bundle-',
        category: 'bundle',
        priority: 'medium',
        title: 'Reduce Bundle Size',
        description: 'Large bundle size detected. Consider implementing code splitting and tree shaking.',
        impact: 'Medium',
        effort: 'high',
        implementation: 'Implement dynamic imports, remove unused code, optimize dependencies',
        estimatedSavings: '20-30% bundle size reduction'
});
  }

    // Network recommendations
    if (metrics.networkRequests > 50) {
      newRecommendations.push({
        id: 'network-',
        category: 'network',
        priority: 'medium',
        title: 'Optimize Network Requests',
        description: 'High number of network requests detected. Consider implementing request batching and caching.',
        impact: 'Medium',
        effort: 'medium',
        implementation: 'Implement request batching, caching strategies, and resource optimization',
        estimatedSavings: '15-25% load time improvement'
});
  }

    // Image optimization recommendations
    if (metrics.imageOptimization < 80) {
      newRecommendations.push({
        id: 'image-',
        category: 'images',
        priority: 'medium',
        title: 'Optimize Images',
        description: 'Images are not optimized. Consider implementing modern image formats and compression.',
        impact: 'Medium',
        effort: 'low',
        implementation: 'Use WebP format, implement lazy loading, optimize image sizes',
        estimatedSavings: '30-50% image size reduction'
});
  }

    setRecommendations(newRecommendations);
}, [memoryInfo, metrics]);

  // Get performance score
  const getPerformanceScore = useCallback((): number => {
    let score = 100;

    // Deduct points for poor metrics
    if (metrics.renderTime > 16) score -= 20;
    if (memoryInfo.memoryUsagePercentage > 80) score -= 15;
    if (metrics.bundleSize > 2000000) score -= 10; // 2MB
    if (metrics.networkRequests > 100) score -= 10;
    if (metrics.firstContentfulPaint > 2000) score -= 15; // 2 seconds
    if (metrics.largestContentfulPaint > 4000) score -= 10; // 4 seconds
    if (metrics.cumulativeLayoutShift > 0.1) score -= 10;

    return Math.max(0, score);
}, [metrics, memoryInfo]);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const score = getPerformanceScore();
    const criticalAlerts = alerts.filter(alert => alert.type === 'error').length;
    const warningAlerts = alerts.filter(alert => alert.type === 'warning').length;
    const highPriorityRecommendations = recommendations.filter(rec => rec.priority === 'high').length;

    return {
      score,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' :',',
      criticalAlerts,
      warningAlerts,
      highPriorityRecommendations,
      totalRecommendations: recommendations.length,
      memoryUsage: memoryInfo.memoryUsagePercentage,
      renderTime: metrics.renderTime,
      bundleSize: metrics.bundleSize
};
}, [getPerformanceScore, alerts, recommendations, memoryInfo, metrics]);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
}, []);

  // Clear performance entries
  const clearPerformanceEntries = useCallback(() => {
    setPerformanceEntries([]);
}, []);

  // Export performance data
  const exportPerformanceData = useCallback(() => {
    return {
      metrics,
      memoryInfo,
      performanceEntries,
      alerts,
      recommendations,
      summary: getPerformanceSummary(),
      timestamp: new Date().toISOString()
  };
}, [metrics, memoryInfo, performanceEntries, alerts, recommendations, getPerformanceSummary]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
  };
}, [stopMonitoring]);

  return {
    // State
    metrics,
    memoryInfo,
    performanceEntries,
    alerts,
    recommendations,
    isMonitoring,

    // Actions
    startMonitoring,
    stopMonitoring,
    measureRenderTime,
    clearAlerts,
    clearPerformanceEntries,
    exportPerformanceData,

    // Computed values
    getPerformanceScore,
    getPerformanceSummary
};
};


