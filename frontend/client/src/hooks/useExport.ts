/**
 * useExport Hook
 * React hook for export functionality with multiple formats and compression
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  exportManager, 
  ExportConfig, 
  ExportState, 
  ExportFormat,
  ExportOptions,
  ExportResult
} from'../utils/exportManager';

export interface UseExportOptions {
  config?: Partial<ExportConfig>;
  onExportCompleted?: (result: ExportResult) => void;
  onExportFailed?: (result: ExportResult) => void;
  onExportStarted?: (options: ExportOptions) => void;
  onExportProgress?: (progress: number) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UseExportReturn {
  export: (data: any, options: ExportOptions) => Promise<ExportResult>;
  getSupportedFormats: () => ExportFormat[];
  getExportHistory: () => ExportResult[];
  getActiveExports: () => ExportResult[];
  state: ExportState;
  config: ExportConfig;
  updateConfig: (config: Partial<ExportConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  currentExport: ExportResult | null;
  exportQueue: ExportResult[];
  exportHistory: ExportResult[];
  supportedFormats: ExportFormat[];
  activeExports: ExportResult[];
  lastExport: number;
  totalExports: number;
  successfulExports: number;
  failedExports: number;
  totalSize: number;
  compressedSize: number;
  compressionRatio: number;
  averageProcessingTime: number;
  averageOptimizationTime: number;
  averageCompressionTime: number;
  averageEncryptionTime: number;
  averageValidationTime: number;
  averageBundlingTime: number;
  averageTreeShakingTime: number;
  averageCodeSplittingTime: number;
  averageSourceMapTime: number;
  averageProgressiveLoadingTime: number;
  averageCachingTime: number;
  averageCdnTime: number;
  averageVersioningTime: number;
  averageBackupTime: number
}

/**
 * Hook for export functionality
 */
export const useExport = (options: UseExportOptions = {}): UseExportReturn => {
  const {
    config = {},
    onExportCompleted,
    onExportFailed,
    onExportStarted,
    onExportProgress,
    onError,
    onInitialized
  } = options;

  const [state, setState] = useState<ExportState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    currentExport: null,
    exportQueue: [],
    exportHistory: [],
    supportedFormats: new Map(),
    activeExports: new Map(),
    lastExport: 0,
    totalExports: 0,
    successfulExports: 0,
    failedExports: 0,
    totalSize: 0,
    compressedSize: 0,
    compressionRatio: 0,
    averageProcessingTime: 0,
    averageOptimizationTime: 0,
    averageCompressionTime: 0,
    averageEncryptionTime: 0,
    averageValidationTime: 0,
    averageBundlingTime: 0,
    averageTreeShakingTime: 0,
    averageCodeSplittingTime: 0,
    averageSourceMapTime: 0,
    averageProgressiveLoadingTime: 0,
    averageCachingTime: 0,
    averageCdnTime: 0,
    averageVersioningTime: 0,
    averageBackupTime: 0
  });

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize export manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      exportManager.updateConfig(config);
  }

    // Setup event handlers
    const handleExportCompleted = (result: ExportResult) => {
      if (onExportCompleted) {
        onExportCompleted(result);
  }
  };

    const handleExportFailed = (result: ExportResult) => {
      if (onExportFailed) {
        onExportFailed(result);
  }
  };

    const handleExportStarted = (options: ExportOptions) => {
      if (onExportStarted) {
        onExportStarted(options);
  }
  };

    const handleExportProgress = (progress: number) => {
      if (onExportProgress) {
        onExportProgress(progress);
  }
  };

    const handleError = (data: { error: string }) => {
      if (onError) {
        onError(data.error);
    }
  };

    const handleInitialized = () => {
      if (onInitialized) {
        onInitialized();
    }
  };

    // Store event handlers
    eventHandlersRef.current.set('export_completed', handleExportCompleted);
    eventHandlersRef.current.set('export_failed', handleExportFailed);
    eventHandlersRef.current.set('export_started', handleExportStarted);
    eventHandlersRef.current.set('export_progress', handleExportProgress);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    exportManager.on('export_completed', handleExportCompleted);
    exportManager.on('export_failed', handleExportFailed);
    exportManager.on('export_started', handleExportStarted);
    exportManager.on('export_progress', handleExportProgress);
    exportManager.on('error', handleError);
    exportManager.on('initialized', handleInitialized);

    // Update initial state
    setState(exportManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        exportManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onExportCompleted, onExportFailed, onExportStarted, onExportProgress, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = exportManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Export data
  const exportData = useCallback(async (data: any, options: ExportOptions) => {
    return await exportManager.export(data, options);
}, []);

  // Get supported formats
  const getSupportedFormats = useCallback(() => {
    return exportManager.getSupportedFormats();
}, []);

  // Get export history
  const getExportHistory = useCallback(() => {
    return exportManager.getExportHistory();
}, []);

  // Get active exports
  const getActiveExports = useCallback(() => {
    return exportManager.getActiveExports();
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<ExportConfig>) => {
    exportManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const config = useMemo(() => {
    return exportManager.getConfig();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    export: exportData,
    getSupportedFormats,
    getExportHistory,
    getActiveExports,
    state,
    config,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    currentExport: state.currentExport,
    exportQueue: state.exportQueue,
    exportHistory: state.exportHistory,
    supportedFormats: Array.from(state.supportedFormats.values(, ), ),
    activeExports: Array.from(state.activeExports.values(, ), ),
    lastExport: state.lastExport,
    totalExports: state.totalExports,
    successfulExports: state.successfulExports,
    failedExports: state.failedExports,
    totalSize: state.totalSize,
    compressedSize: state.compressedSize,
    compressionRatio: state.compressionRatio,
    averageProcessingTime: state.averageProcessingTime,
    averageOptimizationTime: state.averageOptimizationTime,
    averageCompressionTime: state.averageCompressionTime,
    averageEncryptionTime: state.averageEncryptionTime,
    averageValidationTime: state.averageValidationTime,
    averageBundlingTime: state.averageBundlingTime,
    averageTreeShakingTime: state.averageTreeShakingTime,
    averageCodeSplittingTime: state.averageCodeSplittingTime,
    averageSourceMapTime: state.averageSourceMapTime,
    averageProgressiveLoadingTime: state.averageProgressiveLoadingTime,
    averageCachingTime: state.averageCachingTime,
    averageCdnTime: state.averageCdnTime,
    averageVersioningTime: state.averageVersioningTime,
    averageBackupTime: state.averageBackupTime
}), [
    exportData,
    getSupportedFormats,
    getExportHistory,
    getActiveExports,
    state,
    config,
    updateConfig
  ]);

  return returnValue;
};

export default useExport;





