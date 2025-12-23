/**
 * useOffline Hook
 * React hook for offline functionality and data persistence
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  offlineManager, 
  OfflineConfig, 
  OfflineData, 
  OfflineState, 
  SyncResult 
} from'../utils/offlineManager';

export interface UseOfflineOptions {
  config?: Partial<OfflineConfig>;
  onDataSaved?: (data: OfflineData) => void;
  onDataDeleted?: (id: string) => void;
  onSyncComplete?: (result: SyncResult) => void;
  onSyncError?: (error: any) => void;
  onConflictManual?: (conflict: any) => void;
  onOnline?: () => void;
  onOffline?: () => void}

export interface UseOfflineReturn {
  state: OfflineState;
  saveData: (id: string, type: string, data: any, metadata?: any) => void;
  getData: (id: string) => OfflineData | null;
  getAllData: () => OfflineData[];
  getDataByType: (type: string) => OfflineData[];
  deleteData: (id: string) => void;
  syncData: () => Promise<SyncResult>;
  clearAllData: () => void;
  updateConfig: (config: Partial<OfflineConfig>) => void;
  getConfig: () => OfflineConfig;
  isOnline: boolean;
  isOfflineMode: boolean;
  isSyncing: boolean;
  hasUnsyncedData: boolean;
  offlineDataCount: number;
  syncQueueSize: number;
  conflictCount: number;
  errorCount: number;
  lastSyncTime: number}

/**
 * Hook for offline functionality
 */
export const useOffline = (options: UseOfflineOptions = {}): UseOfflineReturn => {
  const {
    config = {},
    onDataSaved,
    onDataDeleted,
    onSyncComplete,
    onSyncError,
    onConflictManual,
    onOnline,
    onOffline
} = options;

  const [state, setState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    isOfflineMode: false,
    isSyncing: false,
    hasUnsyncedData: false,
    lastSyncTime: 0,
    offlineDataCount: 0,
    syncQueueSize: 0,
    conflictCount: 0,
    errorCount: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize offline manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      offlineManager.updateConfig(config);
  }

    // Setup event handlers
    const handleDataSaved = (data: OfflineData) => {
      if (onDataSaved) {
        onDataSaved(data);
}
  };

    const handleDataDeleted = (id: string) => {
      if (onDataDeleted) {
        onDataDeleted(id);
}
  };

    const handleSyncComplete = (result: SyncResult) => {
      if (onSyncComplete) {
        onSyncComplete(result);
}
  };

    const handleSyncError = (error: any) => {
      if (onSyncError) {
        onSyncError(error);
}
  };

    const handleConflictManual = (conflict: any) => {
      if (onConflictManual) {
        onConflictManual(conflict);
}
  };

    const handleOnline = () => {
      if (onOnline) {
        onOnline();
    }
  };

    const handleOffline = () => {
      if (onOffline) {
        onOffline();
    }
  };

    // Store event handlers
    eventHandlersRef.current.set('data_saved', handleDataSaved);
    eventHandlersRef.current.set('data_deleted', handleDataDeleted);
    eventHandlersRef.current.set('sync_complete', handleSyncComplete);
    eventHandlersRef.current.set('sync_error', handleSyncError);
    eventHandlersRef.current.set('conflict_manual', handleConflictManual);
    eventHandlersRef.current.set('online', handleOnline);
    eventHandlersRef.current.set('offline', handleOffline);

    // Add event listeners
    offlineManager.on('data_saved', handleDataSaved);
    offlineManager.on('data_deleted', handleDataDeleted);
    offlineManager.on('sync_complete', handleSyncComplete);
    offlineManager.on('sync_error', handleSyncError);
    offlineManager.on('conflict_manual', handleConflictManual);
    offlineManager.on('online', handleOnline);
    offlineManager.on('offline', handleOffline);

    // Update initial state
    setState(offlineManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        offlineManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onDataSaved, onDataDeleted, onSyncComplete, onSyncError, onConflictManual, onOnline, onOffline]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = offlineManager.getState();
      setState(currentState);
  }, 1000);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Save data
  const saveData = useCallback((id: string, type: string, data: any, metadata: any = {}) => {
    offlineManager.saveData(id, type, data, metadata);
}, []);

  // Get data
  const getData = useCallback((id: string) => {
    return offlineManager.getData(id);
}, []);

  // Get all data
  const getAllData = useCallback(() => {
    return offlineManager.getAllData();
}, []);

  // Get data by type
  const getDataByType = useCallback((type: string) => {
    return offlineManager.getDataByType(type);
}, []);

  // Delete data
  const deleteData = useCallback((id: string) => {
    offlineManager.deleteData(id);
}, []);

  // Sync data
  const syncData = useCallback(async () => {
    return await offlineManager.syncData();
}, []);

  // Clear all data
  const clearAllData = useCallback(() => {
    offlineManager.clearAllData();
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<OfflineConfig>) => {
    offlineManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const getConfig = useCallback(() => {
    return offlineManager.getConfig();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    state,
    saveData,
    getData,
    getAllData,
    getDataByType,
    deleteData,
    syncData,
    clearAllData,
    updateConfig,
    getConfig,
    isOnline: state.isOnline,
    isOfflineMode: state.isOfflineMode,
    isSyncing: state.isSyncing,
    hasUnsyncedData: state.hasUnsyncedData,
    offlineDataCount: state.offlineDataCount,
    syncQueueSize: state.syncQueueSize,
    conflictCount: state.conflictCount,
    errorCount: state.errorCount,
    lastSyncTime: state.lastSyncTime
}), [
    state,
    saveData,
    getData,
    getAllData,
    getDataByType,
    deleteData,
    syncData,
    clearAllData,
    updateConfig,
    getConfig
  ]);

  return returnValue;
};

export default useOffline;





