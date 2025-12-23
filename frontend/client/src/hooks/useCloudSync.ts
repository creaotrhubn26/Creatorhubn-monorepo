/**
 * useCloudSync Hook
 * React hook for cloud synchronization and backup functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  cloudSyncManager, 
  CloudSyncConfig, 
  CloudSyncManagerState, 
  CloudProvider,
  BackupConfig,
  SyncItem,
  SyncConflict,
  SyncSession
} from'../utils/cloudSyncManager';

export interface UseCloudSyncOptions {
  config?: Partial<CloudSyncConfig>;
  onProviderAdded?: (data: { provider: CloudProvider }) => void;
  onBackupConfigAdded?: (data: { backupConfig: BackupConfig }) => void;
  onSyncSessionStarted?: (data: { session: SyncSession }) => void;
  onSyncSessionStopped?: (data: { session: SyncSession }) => void;
  onConflictDetected?: (data: { conflict: SyncConflict }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void;
}

export interface UseCloudSyncReturn {
  addProvider: (providerData: Partial<CloudProvider>) => Promise<CloudProvider>;
  addBackupConfig: (backupConfigData: Partial<BackupConfig>) => Promise<BackupConfig>;
  startSyncSession: (providerId: string, items: SyncItem[]) => Promise<SyncSession>;
  stopSyncSession: (sessionId: string) => Promise<void>;
  getProvider: (id: string) => CloudProvider | null;
  getBackupConfig: (id: string) => BackupConfig | null;
  getSyncItem: (id: string) => SyncItem | null;
  getConflict: (id: string) => SyncConflict | null;
  getSession: (id: string) => SyncSession | null;
  state: CloudSyncManagerState;
  config: CloudSyncConfig;
  updateConfig: (config: Partial<CloudSyncConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  providers: CloudProvider[];
  syncItems: SyncItem[];
  conflicts: SyncConflict[];
  sessions: SyncSession[];
  backupConfigs: BackupConfig[];
  currentSession: SyncSession | null;
  lastSync: number;
  lastBackup: number;
  totalItems: number;
  totalSynced: number;
  totalFailed: number;
  totalConflicts: number;
  totalErrors: number;
  totalBackups: number;
  totalStorage: number;
  totalBandwidth: number;
  getAllProviders: () => CloudProvider[];
  getAllBackupConfigs: () => BackupConfig[];
  getAllSyncItems: () => SyncItem[];
  getAllConflicts: () => SyncConflict[];
  getAllSessions: () => SyncSession[];
}

/**
 * Hook for cloud synchronization and backup functionality
 */
export const useCloudSync = (options: UseCloudSyncOptions = {}): UseCloudSyncReturn => {
  const {
    config = {},
    onProviderAdded,
    onBackupConfigAdded,
    onSyncSessionStarted,
    onSyncSessionStopped,
    onConflictDetected,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<CloudSyncManagerState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    providers: new Map(),
    syncItems: new Map(),
    conflicts: new Map(),
    sessions: new Map(),
    backupConfigs: new Map(),
    currentSession: null,
    lastSync: 0,
    lastBackup: 0,
    totalItems: 0,
    totalSynced: 0,
    totalFailed: 0,
    totalConflicts: 0,
    totalErrors: 0,
    totalBackups: 0,
    totalStorage: 0,
    totalBandwidth: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize cloud sync manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      (cloudSyncManager as any).updateConfig(config);
  }

    // Setup event handlers
    const handleProviderAdded = (data: { provider: CloudProvider }) => {
      if (onProviderAdded) {
        onProviderAdded(data);
    }
  };

    const handleBackupConfigAdded = (data: { backupConfig: BackupConfig }) => {
      if (onBackupConfigAdded) {
        onBackupConfigAdded(data);
    }
  };

    const handleSyncSessionStarted = (data: { session: SyncSession }) => {
      if (onSyncSessionStarted) {
        onSyncSessionStarted(data);
    }
  };

    const handleSyncSessionStopped = (data: { session: SyncSession }) => {
      if (onSyncSessionStopped) {
        onSyncSessionStopped(data);
    }
  };

    const handleConflictDetected = (data: { conflict: SyncConflict }) => {
      if (onConflictDetected) {
        onConflictDetected(data);
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
    eventHandlersRef.current.set('provider_added', handleProviderAdded);
    eventHandlersRef.current.set('backup_config_added', handleBackupConfigAdded);
    eventHandlersRef.current.set('sync_session_started', handleSyncSessionStarted);
    eventHandlersRef.current.set('sync_session_stopped', handleSyncSessionStopped);
    eventHandlersRef.current.set('conflict_detected', handleConflictDetected);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    (cloudSyncManager as any).on('provider_added', handleProviderAdded);
    (cloudSyncManager as any).on('backup_config_added', handleBackupConfigAdded);
    (cloudSyncManager as any).on('sync_session_started', handleSyncSessionStarted);
    (cloudSyncManager as any).on('sync_session_stopped', handleSyncSessionStopped);
    (cloudSyncManager as any).on('conflict_detected', handleConflictDetected);
    (cloudSyncManager as any).on('error', handleError);
    (cloudSyncManager as any).on('initialized', handleInitialized);

    // Update initial state
    setState((cloudSyncManager as any).getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        (cloudSyncManager as any).off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onProviderAdded, onBackupConfigAdded, onSyncSessionStarted, onSyncSessionStopped, onConflictDetected, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = (cloudSyncManager as any).getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Add provider
  const addProvider = useCallback(async (providerData: Partial<CloudProvider>) => {
    return await (cloudSyncManager as any).addProvider(providerData);
}, []);

  // Add backup config
  const addBackupConfig = useCallback(async (backupConfigData: Partial<BackupConfig>) => {
    return await (cloudSyncManager as any).addBackupConfig(backupConfigData);
}, []);

  // Start sync session
  const startSyncSession = useCallback(async (providerId: string, items: SyncItem[]) => {
    return await (cloudSyncManager as any).startSyncSession(providerId, items);
}, []);

  // Stop sync session
  const stopSyncSession = useCallback(async (sessionId: string) => {
    return await (cloudSyncManager as any).stopSyncSession(sessionId);
}, []);

  // Get provider by ID
  const getProvider = useCallback((id: string) => {
    return (cloudSyncManager as any).getProvider(id);
}, []);

  // Get backup config by ID
  const getBackupConfig = useCallback((id: string) => {
    return (cloudSyncManager as any).getBackupConfig(id);
}, []);

  // Get sync item by ID
  const getSyncItem = useCallback((id: string) => {
    return (cloudSyncManager as any).getSyncItem(id);
}, []);

  // Get conflict by ID
  const getConflict = useCallback((id: string) => {
    return (cloudSyncManager as any).getConflict(id);
}, []);

  // Get session by ID
  const getSession = useCallback((id: string) => {
    return (cloudSyncManager as any).getSession(id);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<CloudSyncConfig>) => {
    (cloudSyncManager as any).updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return (cloudSyncManager as any).getConfig();
}, []);

  // Get all providers
  const getAllProviders = useCallback(() => {
    return (cloudSyncManager as any).getAllProviders();
}, []);

  // Get all backup configs
  const getAllBackupConfigs = useCallback(() => {
    return (cloudSyncManager as any).getAllBackupConfigs();
}, []);

  // Get all sync items
  const getAllSyncItems = useCallback(() => {
    return (cloudSyncManager as any).getAllSyncItems();
}, []);

  // Get all conflicts
  const getAllConflicts = useCallback(() => {
    return (cloudSyncManager as any).getAllConflicts();
}, []);

  // Get all sessions
  const getAllSessions = useCallback(() => {
    return (cloudSyncManager as any).getAllSessions();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    addProvider,
    addBackupConfig,
    startSyncSession,
    stopSyncSession,
    getProvider,
    getBackupConfig,
    getSyncItem,
    getConflict,
    getSession,
    state,
    config: currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    providers: Array.from(state.providers.values()),
    syncItems: Array.from(state.syncItems.values()),
    conflicts: Array.from(state.conflicts.values()),
    sessions: Array.from(state.sessions.values()),
    backupConfigs: Array.from(state.backupConfigs.values()),
    currentSession: state.currentSession,
    lastSync: state.lastSync,
    lastBackup: state.lastBackup,
    totalItems: state.totalItems,
    totalSynced: state.totalSynced,
    totalFailed: state.totalFailed,
    totalConflicts: state.totalConflicts,
    totalErrors: state.totalErrors,
    totalBackups: state.totalBackups,
    totalStorage: state.totalStorage,
    totalBandwidth: state.totalBandwidth,
    getAllProviders,
    getAllBackupConfigs,
    getAllSyncItems,
    getAllConflicts,
    getAllSessions
}), [
    addProvider,
    addBackupConfig,
    startSyncSession,
    stopSyncSession,
    getProvider,
    getBackupConfig,
    getSyncItem,
    getConflict,
    getSession,
    state,
    currentConfig,
    updateConfig,
    getAllProviders,
    getAllBackupConfigs,
    getAllSyncItems,
    getAllConflicts,
    getAllSessions
  ]);

  return returnValue as UseCloudSyncReturn;
};

export default useCloudSync;



