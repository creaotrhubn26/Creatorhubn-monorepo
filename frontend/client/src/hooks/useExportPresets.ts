/**
 * useExportPresets Hook
 * React hook for export presets management functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  exportPresetsManager, 
  ExportPresetConfig, 
  ExportPresetManagerState, 
  ExportPreset,
  ExportPlatform,
  ExportFormat
} from'../utils/exportPresetsManager';

export interface UseExportPresetsOptions {
  config?: Partial<ExportPresetConfig>;
  onPresetAdded?: (data: { preset: ExportPreset }) => void;
  onPlatformAdded?: (data: { platform: ExportPlatform }) => void;
  onFormatAdded?: (data: { format: ExportFormat }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UseExportPresetsReturn {
  addPreset: (presetData: Partial<ExportPreset>) => Promise<ExportPreset>;
  addPlatform: (platformData: Partial<ExportPlatform>) => Promise<ExportPlatform>;
  addFormat: (formatData: Partial<ExportFormat>) => Promise<ExportFormat>;
  getPreset: (id: string) => ExportPreset | null;
  getPlatform: (id: string) => ExportPlatform | null;
  getFormat: (id: string) => ExportFormat | null;
  state: ExportPresetManagerState;
  config: ExportPresetConfig;
  updateConfig: (config: Partial<ExportPresetConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  presets: ExportPreset[];
  platforms: ExportPlatform[];
  formats: ExportFormat[];
  lastExport: ExportPreset | null;
  totalPresets: number;
  totalPlatforms: number;
  totalFormats: number;
  totalExports: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number;
  getAllPresets: () => ExportPreset[];
  getAllPlatforms: () => ExportPlatform[];
  getAllFormats: () => ExportFormat[]
}

/**
 * Hook for export presets management functionality
 */
export const useExportPresets = (options: UseExportPresetsOptions = {}): UseExportPresetsReturn => {
  const {
    config = {},
    onPresetAdded,
    onPlatformAdded,
    onFormatAdded,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<ExportPresetManagerState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    presets: new Map(),
    platforms: new Map(),
    formats: new Map(),
    lastExport: null,
    lastUpdate:  0,
    totalPresets:  0,
    totalPlatforms:  0,
    totalFormats:  0,
    totalExports:  0,
    totalErrors:  0,
    totalConflicts:  0,
    totalOverrides: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize export presets manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      exportPresetsManager.updateConfig(config);
  }

    // Setup event handlers
    const handlePresetAdded = (data: { preset: ExportPreset }) => {
      if (onPresetAdded) {
        onPresetAdded(data);
    }
  };

    const handlePlatformAdded = (data: { platform: ExportPlatform }) => {
      if (onPlatformAdded) {
        onPlatformAdded(data);
    }
  };

    const handleFormatAdded = (data: { format: ExportFormat }) => {
      if (onFormatAdded) {
        onFormatAdded(data);
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
    eventHandlersRef.current.set('preset_added', handlePresetAdded);
    eventHandlersRef.current.set('platform_added', handlePlatformAdded);
    eventHandlersRef.current.set('format_added', handleFormatAdded);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    exportPresetsManager.on('preset_added', handlePresetAdded);
    exportPresetsManager.on('platform_added', handlePlatformAdded);
    exportPresetsManager.on('format_added', handleFormatAdded);
    exportPresetsManager.on('error', handleError);
    exportPresetsManager.on('initialized', handleInitialized);

    // Update initial state
    setState(exportPresetsManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        exportPresetsManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onPresetAdded, onPlatformAdded, onFormatAdded, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = exportPresetsManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Add preset
  const addPreset = useCallback(async (presetData: Partial<ExportPreset>) => {
    return await exportPresetsManager.addPreset(presetData);
}, []);

  // Add platform
  const addPlatform = useCallback(async (platformData: Partial<ExportPlatform>) => {
    return await exportPresetsManager.addPlatform(platformData);
}, []);

  // Add format
  const addFormat = useCallback(async (formatData: Partial<ExportFormat>) => {
    return await exportPresetsManager.addFormat(formatData);
}, []);

  // Get preset by ID
  const getPreset = useCallback((id: string) => {
    return exportPresetsManager.getPreset(id);
}, []);

  // Get platform by ID
  const getPlatform = useCallback((id: string) => {
    return exportPresetsManager.getPlatform(id);
}, []);

  // Get format by ID
  const getFormat = useCallback((id: string) => {
    return exportPresetsManager.getFormat(id);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<ExportPresetConfig>) => {
    exportPresetsManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return exportPresetsManager.getConfig();
}, []);

  // Get all presets
  const getAllPresets = useCallback(() => {
    return exportPresetsManager.getAllPresets();
}, []);

  // Get all platforms
  const getAllPlatforms = useCallback(() => {
    return exportPresetsManager.getAllPlatforms();
}, []);

  // Get all formats
  const getAllFormats = useCallback(() => {
    return exportPresetsManager.getAllFormats();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    addPreset,
    addPlatform,
    addFormat,
    getPreset,
    getPlatform,
    getFormat,
    state,
    config: currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    presets: Array.from(state.presets.values()),
    platforms: Array.from(state.platforms.values()),
    formats: Array.from(state.formats.values()),
    lastExport: state.lastExport,
    totalPresets: state.totalPresets,
    totalPlatforms: state.totalPlatforms,
    totalFormats: state.totalFormats,
    totalExports: state.totalExports,
    totalErrors: state.totalErrors,
    totalConflicts: state.totalConflicts,
    totalOverrides: state.totalOverrides,
    getAllPresets,
    getAllPlatforms,
    getAllFormats
}), [
    addPreset,
    addPlatform,
    addFormat,
    getPreset,
    getPlatform,
    getFormat,
    state,
    currentConfig,
    updateConfig,
    getAllPresets,
    getAllPlatforms,
    getAllFormats
  ]);

  return returnValue;
};

export default useExportPresets;



