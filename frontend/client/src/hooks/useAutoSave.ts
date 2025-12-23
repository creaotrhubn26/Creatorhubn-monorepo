/**
 * useAutoSave Hook
 * React hook for auto-save functionality with debouncing and conflict resolution
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  autoSaveManager, 
  AutoSaveConfig, 
  AutoSaveState, 
  AutoSaveData 
} from'../utils/autoSaveManager';

export interface UseAutoSaveOptions {
  config?: Partial<AutoSaveConfig>;
  onDataSaved?: (data: AutoSaveData) => void;
  onDataQueued?: (data: AutoSaveData) => void;
  onConflictDetected?: (conflict: any) => void;
  onConflictResolved?: (conflict: any) => void;
  onError?: (error: string) => void;
  onPaused?: () => void;
  onResumed?: () => void;
  onBackupCreated?: (data: { timestamp: number }) => void;
  onBackupRestored?: (data: { timestamp: number }) => void;
  onInitialized?: () => void;
}

export interface UseAutoSaveReturn {
  save: (type: string, data: any, metadata?: Record<string, any>) => void;
  forceSave: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  clearQueue: () => void;
  restoreFromBackup: () => boolean;
  state: AutoSaveState;
  config: AutoSaveConfig;
  updateConfig: (config: Partial<AutoSaveConfig>) => void;
  isEnabled: boolean;
  isSaving: boolean;
  isPaused: boolean;
  hasError: boolean;
  error: string | null;
  lastSave: number;
  nextSave: number;
  saveCount: number;
  errorCount: number;
  conflictCount: number;
  queueSize: number;
  currentVersion: number;
  pendingChanges: boolean;
}

/**
 * Hook for auto-save functionality
 */
export const useAutoSave = (options: UseAutoSaveOptions = {}): UseAutoSaveReturn => {
  const {
    config = {},
    onDataSaved,
    onDataQueued,
    onConflictDetected,
    onConflictResolved,
    onError,
    onPaused,
    onResumed,
    onBackupCreated,
    onBackupRestored,
    onInitialized
} = options;

  const [state, setState] = useState<AutoSaveState>({
    isEnabled: false,
    isSaving: false,
    isPaused: false,
    hasError: false,
    error: null,
    lastSave: 0,
    nextSave: 0,
    saveCount: 0,
    errorCount: 0,
    conflictCount: 0,
    queueSize: 0,
    currentVersion: 1,
    pendingChanges: false
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize auto-save manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      autoSaveManager.updateConfig(config);
  }

    // Setup event handlers
    const handleDataSaved = (data: AutoSaveData) => {
      if (onDataSaved) {
        onDataSaved(data);
    }
  };

    const handleDataQueued = (data: AutoSaveData) => {
      if (onDataQueued) {
        onDataQueued(data);
    }
  };

    const handleConflictDetected = (conflict: any) => {
      if (onConflictDetected) {
        onConflictDetected(conflict);
    }
  };

    const handleConflictResolved = (conflict: any) => {
      if (onConflictResolved) {
        onConflictResolved(conflict);
    }
  };

    const handleError = (data: { error: string }) => {
      if (onError) {
        onError(data.error);
    }
  };

    const handlePaused = () => {
      if (onPaused) {
        onPaused();
    }
  };

    const handleResumed = () => {
      if (onResumed) {
        onResumed();
    }
  };
    const handleBackupCreated = (data: { timestamp: number }) => {
      if (onBackupCreated) {
        onBackupCreated(data);
    }
  };

    const handleBackupRestored = (data: { timestamp: number }) => {
      if (onBackupRestored) {
        onBackupRestored(data);
    }
  };

    const handleInitialized = () => {
      if (onInitialized) {
        onInitialized();
    }
  };

    // Store event handlers
    eventHandlersRef.current.set('data_saved', handleDataSaved);
    eventHandlersRef.current.set('data_queued', handleDataQueued);
    eventHandlersRef.current.set('conflict_detected', handleConflictDetected);
    eventHandlersRef.current.set('conflict_resolved', handleConflictResolved);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('paused', handlePaused);
    eventHandlersRef.current.set('resumed', handleResumed);
    eventHandlersRef.current.set('backup_created', handleBackupCreated);
    eventHandlersRef.current.set('backup_restored', handleBackupRestored);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    autoSaveManager.on('data_saved', handleDataSaved);
    autoSaveManager.on('data_queued', handleDataQueued);
    autoSaveManager.on('conflict_detected', handleConflictDetected);
    autoSaveManager.on('conflict_resolved', handleConflictResolved);
    autoSaveManager.on('error', handleError);
    autoSaveManager.on('paused', handlePaused);
    autoSaveManager.on('resumed', handleResumed);
    autoSaveManager.on('backup_created', handleBackupCreated);
    autoSaveManager.on('backup_restored', handleBackupRestored);
    autoSaveManager.on('initialized', handleInitialized);

    // Update initial state
    setState(autoSaveManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        autoSaveManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onDataSaved, onDataQueued, onConflictDetected, onConflictResolved, onError, onPaused, onResumed, onBackupCreated, onBackupRestored, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = autoSaveManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Save data
  const save = useCallback((type: string, data: any, metadata: Record<string, any> = {}) => {
    autoSaveManager.save(type, data, metadata);
}, []);

  // Force save
  const forceSave = useCallback(async () => {
    await autoSaveManager.forceSave();
}, []);

  // Pause auto-save
  const pause = useCallback(() => {
    autoSaveManager.pause();
}, []);

  // Resume auto-save
  const resume = useCallback(() => {
    autoSaveManager.resume();
}, []);

  // Clear queue
  const clearQueue = useCallback(() => {
    autoSaveManager.clearQueue();
}, []);

  // Restore from backup
  const restoreFromBackup = useCallback(() => {
    return autoSaveManager.restoreFromBackup();
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<AutoSaveConfig>) => {
    autoSaveManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return autoSaveManager.getConfig();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    save,
    forceSave,
    pause,
    resume,
    clearQueue,
    restoreFromBackup,
    state,
    config: currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isSaving: state.isSaving,
    isPaused: state.isPaused,
    hasError: state.hasError,
    error: state.error,
    lastSave: state.lastSave,
    nextSave: state.nextSave,
    saveCount: state.saveCount,
    errorCount: state.errorCount,
    conflictCount: state.conflictCount,
    queueSize: state.queueSize,
    currentVersion: state.currentVersion,
    pendingChanges: state.pendingChanges
}), [
    save,
    forceSave,
    pause,
    resume,
    clearQueue,
    restoreFromBackup,
    state,
    currentConfig,
    updateConfig
  ]);

  return returnValue;
};

export default useAutoSave;
