/**
 * useCanvasOptimization Hook
 * React hook for canvas optimization and performance monitoring
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  canvasOptimizer, 
  CanvasConfig, 
  CanvasMetrics, 
  RenderObject, 
  Viewport, 
  OptimizationResult 
} from'../utils/canvasOptimizer';

export interface UseCanvasOptimizationOptions {
  config?: Partial<CanvasConfig>;
  autoStart?: boolean;
  enableMetrics?: boolean;
  enableOptimization?: boolean;
  onMetricsUpdate?: (metrics: CanvasMetrics) => void;
  onOptimizationUpdate?: (result: OptimizationResult) => void}

export interface UseCanvasOptimizationReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  metrics: CanvasMetrics;
  optimizationResult: OptimizationResult | null;
  isRendering: boolean;
  startRendering: () => void;
  stopRendering: () => void;
  addObject: (obj: RenderObject) => void;
  removeObject: (id: string) => void;
  updateObject: (id: string, updates: Partial<RenderObject>) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  updateConfig: (config: Partial<CanvasConfig>) => void;
  getOptimizationRecommendations: () => OptimizationResult;
  clearCanvas: () => void;
  resetMetrics: () => void}

/**
 * Hook for canvas optimization
 */
export const useCanvasOptimization = (options: UseCanvasOptimizationOptions ={}): UseCanvasOptimizationReturn => {
  const {
    config = {},
    autoStart = true,
    enableMetrics = true,
    enableOptimization = true,
    onMetricsUpdate,
    onOptimizationUpdate
} = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [metrics, setMetrics] = useState<CanvasMetrics>({
    fps:  0,
    frameTime:  0,
    drawCalls:  0,
    triangles:  0,
    vertices:  0,
    textures:  0,
    memoryUsage:  0,
    renderTime:  0,
    cullTime:  0,
    batchTime: 0
});
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const optimizationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current) {
      try {
        // Robust canvas initialization
        canvasOptimizer.initializeCanvas(canvasRef.current);
        canvasOptimizer.updateConfig(config);
        
        if (autoStart) {
          canvasOptimizer.startRendering();
          setIsRendering(true);
      }
    } catch (error) {
        console.error('Failed to initialize canvas: ', error);
    }
  }
}, [config, autoStart]);

  // Setup metrics monitoring
  useEffect(() => {
    if (enableMetrics) {
      metricsIntervalRef.current = setInterval(() => {
        // Robust metrics retrieval
        const currentMetrics = canvasOptimizer.getMetrics();
        setMetrics(currentMetrics);
        
        if (onMetricsUpdate) {
          onMetricsUpdate(currentMetrics);
      }
    }, 1000);
  }

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
    }
  };
}, [enableMetrics, onMetricsUpdate]);

  // Setup optimization monitoring
  useEffect(() => {
    if (enableOptimization) {
      optimizationIntervalRef.current = setInterval(() => {
        // Robust optimization analysis
        const result = canvasOptimizer.getOptimizationRecommendations();
        setOptimizationResult(result);
        
        if (onOptimizationUpdate) {
          onOptimizationUpdate(result);
      }
    }, 5000);
  }

    return () => {
      if (optimizationIntervalRef.current) {
        clearInterval(optimizationIntervalRef.current);
    }
  };
}, [enableOptimization, onOptimizationUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      canvasOptimizer.stopRendering();
      canvasOptimizer.destroy();
  };
}, []);

  // Start rendering
  const startRendering = useCallback(() => {
    canvasOptimizer.startRendering();
    setIsRendering(true);
}, []);

  // Stop rendering
  const stopRendering = useCallback(() => {
    canvasOptimizer.stopRendering();
    setIsRendering(false);
}, []);

  // Add object
  const addObject = useCallback((obj: RenderObject) => {
    canvasOptimizer.addRenderObject(obj);
}, []);

  // Remove object
  const removeObject = useCallback((id: string) => {
    canvasOptimizer.removeRenderObject(id);
}, []);

  // Update object
  const updateObject = useCallback((id: string, updates: Partial<RenderObject>) => {
    canvasOptimizer.updateRenderObject(id, updates);
}, []);

  // Set viewport
  const setViewport = useCallback((viewport: Partial<Viewport>) => {
    canvasOptimizer.setViewport(viewport);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<CanvasConfig>) => {
    canvasOptimizer.updateConfig(newConfig);
}, []);

  // Get optimization recommendations
  const getOptimizationRecommendations = useCallback(() => {
    return canvasOptimizer.getOptimizationRecommendations();
}, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0canvasRef.current.width, canvasRef.current.height);
    }
  }
}, []);

import { useEffect, useRef } from "react";

export function useCanvasOptimization(canvas?: HTMLCanvasElement | null) {
  const rafId = useRef<number | null>(null);
  const isClient = typeof window !=="undefined";

  useEffect(() => {
    if (!isClient || !canvas) return;

    const optimize = () => {
      // … your draw logic here
      rafId.current = window.requestAnimationFrame(optimize);
    };
    rafId.current = window.requestAnimationFrame(optimize);

    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
  }, [isClient, canvas]);
}

  // Reset metrics
  const resetMetrics = useCallback(() => {
    setMetrics({
      fps:  0,
      frameTime:  0,
      drawCalls:  0,
      triangles:  0,
      vertices:  0,
      textures:  0,
      memoryUsage:  0,
      renderTime:  0,
      cullTime:  0,
      batchTime: 0
});
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    canvasRef,
    metrics,
    optimizationResult,
    isRendering,
    startRendering,
    stopRendering,
    addObject,
    removeObject,
    updateObject,
    setViewport,
    updateConfig,
    getOptimizationRecommendations,
    clearCanvas,
    resetMetrics
}), [
    metrics,
    optimizationResult,
    isRendering,
    startRendering,
    stopRendering,
    addObject,
    removeObject,
    updateObject,
    setViewport,
    updateConfig,
    getOptimizationRecommendations,
    clearCanvas,
    resetMetrics
  ]);

  return returnValue;
};

export default useCanvasOptimization;





