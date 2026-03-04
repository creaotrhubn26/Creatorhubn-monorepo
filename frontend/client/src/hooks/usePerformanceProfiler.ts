/**
 * usePerformanceProfiler Hook
 * React hook for performance profiling functionality
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import type { PerformanceMetric, PerformanceProfile} from '@/utils/performanceProfiler';
import { performanceProfiler, ProfilerConfig } from '@/utils/performanceProfiler';

export interface UsePerformanceProfilerOptions {
  enableProfiling?: boolean;
  enableRealTimeProfiling?: boolean;
  enableMemoryProfiling?: boolean;
  enableNetworkProfiling?: boolean;
  enableRenderProfiling?: boolean;
  enableCpuProfiling?: boolean;
  sampleRate?: number;
  onAlert?: (alert: any) => void;
  onReport?: (report: any) => void;
}

export interface UsePerformanceProfilerReturn {
  startProfile: (name: string, metadata?: Record<string, any>) => string;
  endProfile: (profileId: string) => PerformanceProfile | null;
  measure: <T>(name: string, fn: () => T, category?: PerformanceMetric['category']) => T;
  measureAsync: <T>(name: string, fn: () => Promise<T>, category?: PerformanceMetric['category']) => Promise<T>;
  recordMetric: (metric: Omit<PerformanceMetric, 'id'>) => void;
  getMetrics: () => PerformanceMetric[];
  getProfiles: () => PerformanceProfile[];
  getActiveProfiles: () => PerformanceProfile[];
  export: (format?: 'json' | 'csv') => string;
  clear: () => void;
  isProfiling: boolean;
  metrics: PerformanceMetric[];
  profiles: PerformanceProfile[];
  activeProfiles: PerformanceProfile[];
  overallScore: number;
  bottleneckCount: number;
  alertCount: number;
}

export const usePerformanceProfiler = (options: UsePerformanceProfilerOptions = {}): UsePerformanceProfilerReturn => {
  const {
    enableProfiling = true,
    enableRealTimeProfiling = true,
    enableMemoryProfiling = true,
    enableNetworkProfiling = true,
    enableRenderProfiling = true,
    enableCpuProfiling = true,
    sampleRate = 1.0,
    onAlert,
    onReport
} = options;

  const [isProfiling, setIsProfiling] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [profiles, setProfiles] = useState<PerformanceProfile[]>([]);
  const [activeProfiles, setActiveProfiles] = useState<PerformanceProfile[]>([]);
  const [overallScore, setOverallScore] = useState(100);
  const [bottleneckCount, setBottleneckCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Profiler config managed within hook
  useEffect(() => {
    // Config would be sent to performance profiler here
    console.log('Performance profiler config updated');
}, [enableProfiling, enableRealTimeProfiling, enableMemoryProfiling, enableNetworkProfiling, enableRenderProfiling, enableCpuProfiling, sampleRate]);

  // Set up event listeners
  useEffect(() => {
    if (!enableProfiling) return;

    const handleAlert = (event: CustomEvent) => {
      const alert = event.detail;
      setAlertCount(prev => prev + 1);
      onAlert?.(alert);
  };

    const handleReport = (event: CustomEvent) => {
      const report = event.detail;
      onReport?.(report);
  };

    if (typeof window !== 'undefined') {
      window.addEventListener('performance-alert', handleAlert as EventListener);
      window.addEventListener('performance-report', handleReport as EventListener);

      return () => {
        window.removeEventListener('performance-alert', handleAlert as EventListener);
        window.removeEventListener('performance-report', handleReport as EventListener);
    };
  }
}, [enableProfiling, onAlert, onReport]);

  // Update data periodically
  useEffect(() => {
    if (!enableProfiling) return;

    const updateData = () => {
      // Data fetching would happen here from performance profiler
      const currentMetrics: PerformanceMetric[] = [];
      const currentProfiles: PerformanceProfile[] = [];
      const currentActiveProfiles: PerformanceProfile[] = [];
      
      setMetrics(currentMetrics);
      setProfiles(currentProfiles);
      setActiveProfiles(currentActiveProfiles);
      
      // Calculate overall score
      const avgScore = currentProfiles.length > 0 
        ? currentProfiles.reduce((sum: number, p: PerformanceProfile) => sum + p.score, 0) / currentProfiles.length
        : 100;
      setOverallScore(Math.round(avgScore));
      
      // Calculate bottleneck count
      const totalBottlenecks = currentProfiles.reduce((sum: number, p: PerformanceProfile) => sum + p.bottlenecks.length, 0);
      setBottleneckCount(totalBottlenecks);
  };

    updateData();
    updateIntervalRef.current = setInterval(updateData, 1000); // Update every second

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
    }
  };
}, [enableProfiling]);

  // Start profile
  const startProfile = useCallback((name: string, metadata: Record<string, any> = {}): string => {
    setIsProfiling(true);
    const profileId = `profile-${Date.now()}`;
    console.log(`Starting profile: ${name}`, metadata);
    return profileId;
}, []);

  // End profile
  const endProfile = useCallback((profileId: string): PerformanceProfile | null => {
    setIsProfiling(false);
    console.log(`Ending profile: ${profileId}`);
    return null;
}, []);

  // Measure function
  const measure = useCallback(<T>(name: string, fn: () => T, category: PerformanceMetric['category'] = 'custom'): T => {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    console.log(`Measured ${name}: ${duration}ms`);
    return result;
}, []);

  // Measure async function
  const measureAsync = useCallback(async <T>(name: string, fn: () => Promise<T>, category: PerformanceMetric['category'] = 'custom'): Promise<T> => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`Measured async ${name}: ${duration}ms`);
    return result;
}, []);

  // Record metric
  const recordMetric = useCallback((metric: Omit<PerformanceMetric, 'id'>) => {
    console.log('Recording metric: ', metric);
}, []);

  // Get metrics
  const getMetrics = useCallback((): PerformanceMetric[] => {
    return metrics;
}, [metrics]);

  // Get profiles
  const getProfiles = useCallback((): PerformanceProfile[] => {
    return profiles;
}, [profiles]);

  // Get active profiles
  const getActiveProfiles = useCallback((): PerformanceProfile[] => {
    return activeProfiles;
}, [activeProfiles]);

  // Export data
  const exportData = useCallback((format: 'json' | 'csv' = 'json'): string => {
    const data = { metrics, profiles, activeProfiles };
    return format === 'json' ? JSON.stringify(data, null, 2) :'CSV export not implemented';
}, [metrics, profiles, activeProfiles]);

  // Clear data
  const clear = useCallback(() => {
    setMetrics([]);
    setProfiles([]);
    setActiveProfiles([]);
    setOverallScore(100);
    setBottleneckCount(0);
    setAlertCount(0);
}, []);

  return {
    startProfile,
    endProfile,
    measure,
    measureAsync,
    recordMetric,
    getMetrics,
    getProfiles,
    getActiveProfiles,
    export: exportData,
    clear,
    isProfiling,
    metrics,
    profiles,
    activeProfiles,
    overallScore,
    bottleneckCount,
    alertCount
};
};

export default usePerformanceProfiler;





