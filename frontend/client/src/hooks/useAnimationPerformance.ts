/**
 * useAnimationPerformance Hook
 * Monitors and optimizes animation performance
 * Implements GPU acceleration, batching, and FPS monitoring
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface AnimationPerformanceMetrics {
  fps: number;
  frameDrops: number;
  memoryUsage: number;
  totalDuration: number;
  jankScore: number; // 0-100, lower is better
  gpuAccelerated: boolean;
  batchedOperations: number;
}

interface PerformanceEntry {
  timestamp: number;
  frameTime: number;
  operation: string;
}

/**
 * Hook for monitoring and optimizing animation performance
 */
export const useAnimationPerformance = () => {
  const [metrics, setMetrics] = useState<AnimationPerformanceMetrics>({
    fps: 60,
    frameDrops: 0,
    memoryUsage: 0,
    totalDuration: 0,
    jankScore: 0,
    gpuAccelerated: false,
    batchedOperations: 0
  });

  const frameTimesRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const performanceEntriesRef = useRef<PerformanceEntry[]>([]);
  const batchQueueRef = useRef<(() => void)[]>([]);
  const isBatchingRef = useRef<boolean>(false);

  /**
   * Check if GPU acceleration is available and enabled
   */
  const checkGPUAcceleration = useCallback((): boolean => {
    const testElement = document.createElement('div');
    testElement.style.transform = 'translateZ(0)';
    document.body.appendChild(testElement);
    
    const computedStyle = window.getComputedStyle(testElement);
    const hasTransform = computedStyle.transform !== 'none';
    
    document.body.removeChild(testElement);
    return hasTransform;
  }, []);

  /**
   * Monitor FPS using requestAnimationFrame
   */
  useEffect(() => {
    const gpuAccelerated = checkGPUAcceleration();
    setMetrics(prev => ({ ...prev, gpuAccelerated }));

    const measureFPS = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;

      // Store frame time
      frameTimesRef.current.push(deltaTime);
      
      // Keep only last 60 frames for rolling average
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Calculate metrics every 60 frames
      if (frameTimesRef.current.length === 60) {
        const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / 60;
        const fps = 1000 / avgFrameTime;
        const frameDrops = frameTimesRef.current.filter(t => t > 16.67).length; // Dropped frames (< 60fps)
        
        // Calculate jank score (consistency of frame times)
        const variance = frameTimesRef.current.reduce((sum, time) => {
          const diff = time - avgFrameTime;
          return sum + (diff * diff);
        }, 0) / 60;
        const jankScore = Math.min(100, Math.sqrt(variance));

        setMetrics(prev => ({
          ...prev,
          fps: Math.round(fps),
          frameDrops,
          jankScore: Math.round(jankScore)
        }));
      }

      animationFrameRef.current = requestAnimationFrame(measureFPS);
    };

    animationFrameRef.current = requestAnimationFrame(measureFPS);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [checkGPUAcceleration]);

  /**
   * Monitor memory usage (if Performance API available)
   */
  useEffect(() => {
    if ('memory' in performance) {
      const interval = setInterval(() => {
        const memory = (performance as any).memory;
        if (memory) {
          const usedJSHeapSize = memory.usedJSHeapSize;
          const totalJSHeapSize = memory.totalJSHeapSize;
          const usagePercent = (usedJSHeapSize / totalJSHeapSize) * 100;
          
          setMetrics(prev => ({
            ...prev,
            memoryUsage: Math.round(usagePercent)
          }));
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, []);

  /**
   * Batch DOM operations for better performance
   * Groups multiple operations into single requestAnimationFrame
   */
  const batchOperation = useCallback((operation: () => void) => {
    batchQueueRef.current.push(operation);

    if (!isBatchingRef.current) {
      isBatchingRef.current = true;
      
      requestAnimationFrame(() => {
        const operations = [...batchQueueRef.current];
        batchQueueRef.current = [];
        isBatchingRef.current = false;

        // Execute all batched operations
        operations.forEach(op => {
          try {
            op();
          } catch (error) {
            console.error('Error in batched operation:', error);
          }
        });

        setMetrics(prev => ({
          ...prev,
          batchedOperations: prev.batchedOperations + operations.length
        }));
      });
    }
  }, []);

  /**
   * Apply GPU acceleration to element
   * Uses transform: translateZ(0) to force GPU rendering
   */
  const enableGPUAcceleration = useCallback((element: HTMLElement) => {
    element.style.transform = element.style.transform 
      ? `${element.style.transform} translateZ(0)` 
      : 'translateZ(0)';
    element.style.willChange = 'transform';
  }, []);

  /**
   * Remove GPU acceleration from element
   */
  const disableGPUAcceleration = useCallback((element: HTMLElement) => {
    element.style.willChange = 'auto';
  }, []);

  /**
   * Optimize animation element for best performance
   */
  const optimizeElement = useCallback((element: HTMLElement) => {
    // Enable GPU acceleration
    enableGPUAcceleration(element);
    
    // Use CSS containment for better rendering performance
    element.style.contain = 'layout style paint';
    
    // Reduce browser reflow/repaint
    element.style.backfaceVisibility = 'hidden';
    element.style.perspective = '1000px';
  }, [enableGPUAcceleration]);

  /**
   * Get performance optimization recommendations
   */
  const getOptimizationRecommendations = useCallback((): string[] => {
    const recommendations: string[] = [];

    if (metrics.fps < 50) {
      recommendations.push('FPS below 50 - Consider reducing animation complexity or enabling GPU acceleration');
    }

    if (metrics.frameDrops > 10) {
      recommendations.push('Frequent frame drops detected - Batch DOM operations or reduce concurrent animations');
    }

    if (metrics.jankScore > 20) {
      recommendations.push('High jank score - Frame times are inconsistent, optimize animation timing');
    }

    if (metrics.memoryUsage > 80) {
      recommendations.push('High memory usage - Clean up completed animations and reduce active animations');
    }

    if (!metrics.gpuAccelerated) {
      recommendations.push('GPU acceleration not detected - Ensure CSS transforms are used');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal ✓');
    }

    return recommendations;
  }, [metrics]);

  /**
   * Get performance status
   */
  const getPerformanceStatus = useCallback((): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (metrics.fps >= 58 && metrics.jankScore < 10) return 'excellent';
    if (metrics.fps >= 50 && metrics.jankScore < 20) return 'good';
    if (metrics.fps >= 40 && metrics.jankScore < 40) return 'fair';
    return 'poor';
  }, [metrics]);

  /**
   * Record performance entry
   */
  const recordEntry = useCallback((operation: string) => {
    const entry: PerformanceEntry = {
      timestamp: performance.now(),
      frameTime: frameTimesRef.current[frameTimesRef.current.length - 1] || 16.67,
      operation
    };

    performanceEntriesRef.current.push(entry);
    
    // Keep only last 100 entries
    if (performanceEntriesRef.current.length > 100) {
      performanceEntriesRef.current.shift();
    }
  }, []);

  return {
    // Metrics
    metrics,
    
    // Performance utilities
    batchOperation,
    enableGPUAcceleration,
    disableGPUAcceleration,
    optimizeElement,
    
    // Analysis
    getOptimizationRecommendations,
    getPerformanceStatus,
    recordEntry,
    
    // Status flags
    isPerformanceGood: metrics.fps >= 50,
    hasGPUAcceleration: metrics.gpuAccelerated
  };
};

export default useAnimationPerformance;














