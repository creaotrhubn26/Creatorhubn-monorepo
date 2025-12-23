/**
 * Offline Manager
 * Manages offline functionality and data persistence
 */

export interface OfflineConfig {
  enableOfflineMode: boolean;
  enableDataPersistence: boolean;
  enableBackgroundSync: boolean;
  enableConflictResolution: boolean;
  enableOfflineQueue: boolean;
  maxOfflineDataSize: number; // MB
  syncInterval: number; // ms
  retryAttempts: number;
  retryDelay: number; // ms
  conflictResolutionStrategy: 'server, ' | 'client' | 'manual' | 'timestamp';
  enableCompression: boolean;
  enableEncryption: boolean;
  encryptionKey?: string
}

export interface OfflineData {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  version: number;
  synced: boolean;
  conflict: boolean;
  metadata: {
    userId?: string;
    deviceId?: string;
    checksum?: string;
    size?: number;
};
}

export interface OfflineState {
  isOnline: boolean;
  isOfflineMode: boolean;
  isSyncing: boolean;
  hasUnsyncedData: boolean;
  lastSyncTime: number;
  offlineDataCount: number;
  syncQueueSize: number;
  conflictCount: number;
  errorCount: number
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  conflicts: number;
  errors: Array<{
    itemId: string;
    error: string;
    timestamp: number;
}>;
  duration: number;
  dataSize: number
}

export interface ConflictResolution {
  itemId: string;
  serverData: any;
  clientData: any;
  resolution: 'server' | 'client' | 'merge' | 'manual';
  resolvedData: any;
  timestamp: number
}

class OfflineManager {
  private config: OfflineConfig;
  private state: OfflineState;
  private offlineData: Map<string, OfflineData> = new Map();
  private syncQueue: OfflineData[] = [];
  private conflicts: Map<string, ConflictResolution> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<OfflineConfig> = {}) {
    this.config = {
      enableOfflineMode: true,
      enableDataPersistence: true,
      enableBackgroundSync: true,
      enableConflictResolution: true,
      enableOfflineQueue: true,
      maxOfflineDataSize: 10, // 100MB
      syncInterval: 3000, // 30 seconds
      retryAttempts:  3,
      retryDelay: 100, // 1 second
      conflictResolutionStrategy: 'timestamp',
      enableCompression: true,
      enableEncryption: false,
      ...config
  };

    this.state = {
      isOnline: navigator.onLine,
      isOfflineMode: false,
      isSyncing: false,
      hasUnsyncedData: false,
      lastSyncTime:  0,
      offlineDataCount:  0,
      syncQueueSize:  0,
      conflictCount:  0,
      errorCount: 0
};

    this.initializeOfflineManager();
}

  /**
   * Initialize offline manager
   */
  private initializeOfflineManager(): void {
    this.setupEventListeners();
    this.setupStorage();
    this.setupBackgroundSync();
    this.isInitialized = true;
}

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Visibility change events
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Before unload events
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
}

  /**
   * Setup storage
   */
  private setupStorage(): void {
    if (!this.config.enableDataPersistence) return;

    try {
      // Load offline data from storage
      this.loadOfflineData();
      
      // Load sync queue from storage
      this.loadSyncQueue();
      
      // Load conflicts from storage
      this.loadConflicts();
  } catch (error) {
      console.error('Failed to setup storage: ', error);
  }
}

  /**
   * Setup background sync
   */
  private setupBackgroundSync(): void {
    if (!this.config.enableBackgroundSync) return;

    this.syncInterval = setInterval(() => {
      if (this.state.isOnline && this.state.hasUnsyncedData) {
        this.syncData();
    }
  }, this.config.syncInterval);
}

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.state.isOnline = true;
    this.state.isOfflineMode = false;
    
    this.emit('online');
    
    // Start syncing if there's unsynced data
    if (this.state.hasUnsyncedData) {
      this.syncData();
  }
}

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.state.isOnline = false;
    this.state.isOfflineMode = true;
    
    this.emit('offline');
}

  /**
   * Handle visibility change
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible' && this.state.isOnline) {
      // Sync when page becomes visible
      if (this.state.hasUnsyncedData) {
        this.syncData();
    }
  }
}

  /**
   * Handle before unload
   */
  private handleBeforeUnload(): void {
    // Save data before page unload
    this.saveOfflineData();
    this.saveSyncQueue();
    this.saveConflicts();
}

  /**
   * Save data offline
   */
  saveData(id: string, type: string, data: any, metadata: any = {}): void {
    if (!this.config.enableOfflineMode) return;

    const offlineData: OfflineData = {
      d,
      type,
      data: this.config.enableCompression ? this.compressData(data) : data,
      timestamp: Date.now(),
      version:  1,
      synced: false,
      conflict: false,
      metadata: {
        userId: metadata.userd,
        deviceId: metadata.deviced,
        checksum: this.calculateChecksum(data),
        size: this.calculateDataSize(data),
        ...metadata
    }
  };

    // Check data size limit
    if (this.getTotalDataSize() + offlineData.metadata.size! > this.config.maxOfflineDataSize * 1024 * 1024) {
      this.emit('error', { type: 'size_limit', message: 'Offline data size limit exceeded',});
      return;
  }

    this.offlineData.set(id, offlineData);
    
    if (this.config.enableOfflineQueue) {
      this.syncQueue.push(offlineData);
  }

    this.updateState();
    this.saveOfflineData();
    
    this.emit('data_saved', { id, type, data });
}

  /**
   * Get data offline
   */
  getData(id: string): OfflineData | null {
    const data = this.offlineData.get(id);
    if (!data) return null;

    return {
      ...data,
      data: this.config.enableCompression ? this.decompressData(data.data) : data.data
};
}

  /**
   * Get all offline data
   */
  getAllData(): OfflineData[] {
    return Array.from(this.offlineData.values()).map(data => ({
      ...data,
      data: this.config.enableCompression ? this.decompressData(data.data) : data.data
}));
}

  /**
   * Get data by type
   */
  getDataByType(type: string): OfflineData[] {
    return this.getAllData().filter(data => data.type === type);
}

  /**
   * Delete data
   */
  deleteData(id: string): void {
    this.offlineData.delete(id);
    this.syncQueue = this.syncQueue.filter(item => item.id !== id);
    this.updateState();
    this.saveOfflineData();
    
    this.emit('data_deleted', { id });
}

  /**
   * Sync data
   */
  async syncData(): Promise<SyncResult> {
    if (!this.state.isOnline || this.state.isSyncing) {
      return {
        success: false,
        syncedItems:  0,
        failedItems:  0,
        conflicts:  0,
        errors:  [],
        duration:  0,
        dataSize: 0
  };
  }

    const startTime = performance.now();
    this.state.isSyncing = true;
    
    const result: SyncResult = {
      success: true,
      syncedItems:  0,
      failedItems:  0,
      conflicts:  0,
      errors:  [],
      duration:  0,
      dataSize: 0
};

    try {
      // Process sync queue
      for (const item of this.syncQueue) {
        try {
          await this.syncItem(item);
          result.syncedItems++;
          result.dataSize += item.metadata.size || 0;
      } catch (error) {
          result.failedItems++;
          result.errors.push({
            itemId: item.d,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
      });
      }
    }

      // Handle conflicts
      result.conflicts = await this.resolveConflicts();

      // Update state
      this.state.hasUnsyncedData = result.failedItems > 0;
      this.state.lastSyncTime = Date.now();
      this.state.errorCount += result.errors.length;

      result.success = result.failedItems === 0;
      result.duration = performance.now() - startTime;

      this.emit('sync_complete', result);
  } catch (error) {
      result.success = false;
      result.duration = performance.now() - startTime;
      
      this.emit('sync_error', { error, result });
  } finally {
      this.state.isSyncing = false;
      this.updateState();
  }

    return result;
}

  /**
   * Sync individual item
   */
  private async syncItem(item: OfflineData): Promise<void> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mark as synced
    item.synced = true;
    this.offlineData.set(item.id, item);
    
    // Remove from sync queue
    this.syncQueue = this.syncQueue.filter(queueItem => queueItem.id !== item.id);
}

  /**
   * Resolve conflicts
   */
  private async resolveConflicts(): Promise<number> {
    let conflictCount = 0;

    for (const [id, conflict] of this.conflicts.entries()) {
      try {
        const resolution = await this.resolveConflict(conflict);
        
        if (resolution) {
          this.conflicts.delete(id);
          conflictCount++;
      }
    } catch (error) {
        console.error('Failed to resolve conflict:', error);
    }
  }

    return conflictCount;
}

  /**
   * Resolve individual conflict
   */
  private async resolveConflict(conflict: ConflictResolution): Promise<boolean> {
    switch (this.config.conflictResolutionStrategy) {
      case 'server':
        return this.resolveConflictServer(conflict);
      case 'client':
        return this.resolveConflictClient(conflict);
      case 'timestamp':
        return this.resolveConflictTimestamp(conflict);
      case 'manual':
        return this.resolveConflictManual(conflict);
      default:
        return false;
}
}

  /**
   * Resolve conflict using server data
   */
  private resolveConflictServer(conflict: ConflictResolution): boolean {
    conflict.resolution = 'server';
    conflict.resolvedData = conflict.serverData;
    conflict.timestamp = Date.now();
    return true;
}

  /**
   * Resolve conflict using client data
   */
  private resolveConflictClient(conflict: ConflictResolution): boolean {
    conflict.resolution = 'client';
    conflict.resolvedData = conflict.clientData;
    conflict.timestamp = Date.now();
    return true;
}

  /**
   * Resolve conflict using timestamp
   */
  private resolveConflictTimestamp(conflict: ConflictResolution): boolean {
    const serverTime = conflict.serverData.timestamp || 0;
    const clientTime = conflict.clientData.timestamp || 0;
    
    if (serverTime > clientTime) {
      conflict.resolution = 'server';
      conflict.resolvedData = conflict.serverData;
} else {
      conflict.resolution = 'client';
      conflict.resolvedData = conflict.clientData;
  }
    
    conflict.timestamp = Date.now();
    return true;
}

  /**
   * Resolve conflict manually
   */
  private resolveConflictManual(conflict: ConflictResolution): boolean {
    // Emit event for manual resolution
    this.emit('conflict_manual', conflict);
    return false; // Will be resolved manually
}

  /**
   * Compress data
   */
  private compressData(data: any): any {
    if (!this.config.enableCompression) return data;
    
    try {
      // Simple compression using JSON stringify
      return JSON.stringify(data);
} catch (error) {
      console.error('Failed to compress data:', error);
      return data;
  }
}

  /**
   * Decompress data
   */
  private decompressData(data: any): any {
    if (!this.config.enableCompression) return data;
    
    try {
      return JSON.parse(data);
} catch (error) {
      console.error('Failed to decompress data:', error);
      return data;
  }
}

  /**
   * Calculate checksum
   */
  private calculateChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
}
    
    return hash.toString(16);
}

  /**
   * Calculate data size
   */
  private calculateDataSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
}

  /**
   * Get total data size
   */
  private getTotalDataSize(): number {
    let totalSize = 0;
    
    for (const data of this.offlineData.values()) {
      totalSize += data.metadata.size || 0;
  }
    
    return totalSize;
}

  /**
   * Update state
   */
  private updateState(): void {
    this.state.offlineDataCount = this.offlineData.size;
    this.state.syncQueueSize = this.syncQueue.length;
    this.state.conflictCount = this.conflicts.size;
    this.state.hasUnsyncedData = this.syncQueue.length > 0;
}

  /**
   * Save offline data to storage
   */
  private saveOfflineData(): void {
    if (!this.config.enableDataPersistence) return;

    try {
      const data = Array.from(this.offlineData.entries());
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'offline_data', value: data })
      }).catch(() => {});
      localStorage.setItem('offline_data', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save offline data:', error);
    }
  }

  /**
   * Load offline data from storage
   */
  private loadOfflineData(): void {
    if (!this.config.enableDataPersistence) return;

    const applyLocal = () => {
      try {
        const data = localStorage.getItem('offline_data');
        if (data) {
          const parsed = JSON.parse(data);
          this.offlineData = new Map(parsed);
        }
      } catch (error) {
        console.error('Failed to load offline data:', error);
      }
    };

    fetch('/api/user/kv/offline_data', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) {
          this.offlineData = new Map(j.data);
        } else {
          applyLocal();
        }
      })
      .catch(applyLocal);
  }

  /**
   * Save sync queue to storage
   */
  private saveSyncQueue(): void {
    if (!this.config.enableDataPersistence) return;

    try {
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'sync_queue', value: this.syncQueue })
      }).catch(() => {});
      localStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Load sync queue from storage
   */
  private loadSyncQueue(): void {
    if (!this.config.enableDataPersistence) return;

    const applyLocal = () => {
      try {
        const data = localStorage.getItem('sync_queue');
        if (data) {
          this.syncQueue = JSON.parse(data);
        }
      } catch (error) {
        console.error('Failed to load sync queue:', error);
      }
    };

    fetch('/api/user/kv/sync_queue', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) {
          this.syncQueue = j.data;
        } else {
          applyLocal();
        }
      })
      .catch(applyLocal);
  }

  /**
   * Save conflicts to storage
   */
  private saveConflicts(): void {
    if (!this.config.enableDataPersistence) return;

    try {
      const data = Array.from(this.conflicts.entries());
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'conflicts', value: data })
      }).catch(() => {});
      localStorage.setItem('conflicts', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save conflicts:', error);
    }
  }

  /**
   * Load conflicts from storage
   */
  private loadConflicts(): void {
    if (!this.config.enableDataPersistence) return;

    const applyLocal = () => {
      try {
        const data = localStorage.getItem('conflicts');
        if (data) {
          const parsed = JSON.parse(data);
          this.conflicts = new Map(parsed);
        }
      } catch (error) {
        console.error('Failed to load conflicts:', error);
      }
    };

    fetch('/api/user/kv/conflicts', { credentials:'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) {
          this.conflicts = new Map(j.data);
        } else {
          applyLocal();
        }
      })
      .catch(applyLocal);
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
  }
    this.eventListeners.get(event)!.push(callback);
}

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
    }
  }
}

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
      } catch (error) {
          console.error('Error in event listener:', error);
      }
    });
  }
}

  /**
   * Get current state
   */
  getState(): OfflineState {
    return { ...this.state };
}

  /**
   * Get configuration
   */
  getConfig(): OfflineConfig {
    return { ...this.config };
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OfflineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart background sync if interval changed
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.setupBackgroundSync();
  }
}

  /**
   * Clear all offline data
   */
  clearAllData(): void {
    this.offlineData.clear();
    this.syncQueue = [];
    this.conflicts.clear();
    this.updateState();
    
    // Clear storage
    localStorage.removeItem('offline_data');
    localStorage.removeItem('sync_queue');
    localStorage.removeItem('conflicts');
    
    this.emit('data_cleared');
}

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
  }
    
    // Remove event listeners
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    
    // Clear data
    this.offlineData.clear();
    this.syncQueue = [];
    this.conflicts.clear();
    this.eventListeners.clear();
    
    this.isInitialized = false;
}
}

// Create singleton instance
export const offlineManager = new OfflineManager();

export default offlineManager;





