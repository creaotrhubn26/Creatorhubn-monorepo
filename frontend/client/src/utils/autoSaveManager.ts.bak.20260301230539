/**
 * Auto-Save Manager
 * Manages auto-save functionality with debouncing and conflict resolution
 */

export interface AutoSaveConfig {
  enableAutoSave: boolean;
  debounceDelay: number;
  maxRetries: number;
  retryDelay: number;
  conflictResolution: 'client, ' | 'server' | 'manual' | 'timestamp';
  enableConflictDetection: boolean;
  enableVersioning: boolean;
  maxVersions: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
  saveOnBlur: boolean;
  saveOnChange: boolean;
  saveOnInterval: boolean;
  saveInterval: number;
  enableOfflineQueue: boolean;
  maxQueueSize: number;
  enableBackup: boolean;
  backupInterval: number;
  debug: boolean;
  userId?: string;
  sessionId?: string;
  deviceId?: string;
}

export interface AutoSaveData {
  id: string;
  type: string;
  data: any;
  version: number;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  checksum: string;
  compressed: boolean;
  encrypted: boolean;
  metadata: {
    size: number;
    lastModified: number;
    source: string;
    deviceId?: string;
};
}

export interface AutoSaveState {
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
  isInitialized?: boolean;
}

export interface ConflictResolution {
  id: string;
  clientData: any;
  serverData: any;
  resolution: 'client' | 'server' | 'merge' | 'manual';
  resolvedData: any;
  timestamp: number;
  userId?: string; 
}

class AutoSaveManager {
  private config: AutoSaveConfig;
  private state: AutoSaveState;
  private saveQueue: AutoSaveData[] = [];
  private conflictQueue: ConflictResolution[] = [];
  private saveTimeout: NodeJS.Timeout | null = null;
  private intervalTimeout: NodeJS.Timeout | null = null;
  private backupTimeout: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Function[]> = new Map();
  private isInitialized = false;

  constructor(config: Partial<AutoSaveConfig> = {}) {
    this.config = {
      enableAutoSave: true,
      debounceDelay: 2000, // 2 seconds
      maxRetries: 3,
      retryDelay: 1000,
      conflictResolution: 'timestamp',
      enableConflictDetection: true,
      enableVersioning: true,
      maxVersions: 10,
      enableCompression: true,
      enableEncryption: false,
      saveOnBlur: true,
      saveOnChange: true,
      saveOnInterval: true,
      saveInterval: 30000, // 30 seconds
      enableOfflineQueue: true,
      maxQueueSize: 100,
      enableBackup: true,
      backupInterval: 300000, // 5 minutes
      debug: false,
      ...config
  };

    this.state = {
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
  };

    this.initializeAutoSave();
}

  /**
   * Initialize auto-save
   */
  private initializeAutoSave(): void {
    if (!this.config.enableAutoSave) return;

    try {
      this.setupEventListeners();
      this.setupIntervals();
      this.state.isEnabled = true;
      this.state.isInitialized = true;
      this.emit('initialized');
  } catch (error) {
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { error: this.state.error });
  }
}

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.config.enableAutoSave) return;

    // Page visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Before unload
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    // Focus events
    if (this.config.saveOnBlur) {
      window.addEventListener('blur', this.handleBlur.bind(this));
  }

    // Online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
}

  /**
   * Setup intervals
   */
  private setupIntervals(): void {
    if (this.config.saveOnInterval) {
      this.intervalTimeout = setInterval(() => {
        if (this.state.pendingChanges && !this.state.isSaving) {
          this.processSaveQueue();
      }
    }, this.config.saveInterval);
  }

    if (this.config.enableBackup) {
      this.backupTimeout = setInterval(() => {
        this.createBackup();
    }, this.config.backupInterval);
  }
}

  /**
   * Save data
   */
  save(type: string, data: any, metadata: Record<string, any> = {}): void {
    if (!this.state.isEnabled || this.state.isPaused) return;

    const autoSaveData: AutoSaveData = {
      id: this.generateId(),
      type,
      data: this.config.enableCompression ? this.compressData(data) : data,
      version: this.state.currentVersion,
      timestamp: Date.now(),
      userId: this.config.userId,
      sessionId: this.config.sessionId,
      checksum: this.calculateChecksum(data),
      compressed: this.config.enableCompression,
      encrypted: this.config.enableEncryption,
      metadata: {
        size: this.calculateDataSize(data),
        lastModified: Date.now(),
        source: 'auto_save',
        deviceId: this.config.deviceId,
        ...metadata
    }
  };

    // Add to queue
    this.saveQueue.push(autoSaveData);
    this.state.queueSize = this.saveQueue.length;
    this.state.pendingChanges = true;

    // Check queue size
    if (this.saveQueue.length > this.config.maxQueueSize) {
      this.saveQueue.shift(); // Remove oldest
  }

    // Debounce save
    this.debounceSave();

    this.emit('data_queued', { data: autoSaveData });
}

  /**
   * Debounce save
   */
  private debounceSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
  }

    this.saveTimeout = setTimeout(() => {
      this.processSaveQueue();
  }, this.config.debounceDelay);
}

  /**
   * Process save queue
   */
  private async processSaveQueue(): Promise<void> {
    if (this.saveQueue.length === 0 || this.state.isSaving) return;

    this.state.isSaving = true;
    this.state.pendingChanges = false;

    const dataToSave = [...this.saveQueue];
    this.saveQueue = [];
    this.state.queueSize = 0;

    try {
      for (const data of dataToSave) {
        await this.saveData(data);
    }

      this.state.saveCount += dataToSave.length;
      this.state.lastSave = Date.now();
      this.state.nextSave = this.state.lastSave + this.config.saveInterval;
      this.state.errorCount = 0;

      this.emit('data_saved', { count: dataToSave.length });
  } catch (error) {
      this.state.errorCount++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Re-queue data on error
      this.saveQueue.unshift(...dataToSave);
      this.state.queueSize = this.saveQueue.length;
      this.state.pendingChanges = true;

      this.emit('error', { error: this.state.error });
  } finally {
      this.state.isSaving = false;
  }
}

  /**
   * Save individual data
   */
  private async saveData(data: AutoSaveData): Promise<void> {
    try {
      // Check for conflicts
      if (this.config.enableConflictDetection) {
        const conflict = await this.checkForConflict(data);
        if (conflict) {
          await this.resolveConflict(conflict);
          return;
      }
    }

      // Save to server
      await this.sendToServer(data);

      // Update version
      this.state.currentVersion++;

      this.emit('data_saved', { data });
  } catch (error) {
      throw error;
  }
}

  /**
   * Check for conflict
   */
  private async checkForConflict(data: AutoSaveData): Promise<ConflictResolution | null> {
    try {
      // Simulate server check
      const serverData = await this.getServerData(data.id);
      
      if (serverData && serverData.version > data.version) {
        return {
          id: data.id,
          clientData: data,
          serverData,
          resolution: 'manual',
          resolvedData: null,
          timestamp: Date.now(),
          userId: this.config.userId
      };
    }
  } catch (error) {
      // No conflict if server check fails
  }

    return null;
}

  /**
   * Resolve conflict
   */
  private async resolveConflict(conflict: ConflictResolution): Promise<void> {
    this.state.conflictCount++;

    switch (this.config.conflictResolution) {
      case 'client':
        conflict.resolution = 'client';
        conflict.resolvedData = conflict.clientData;
        break;
      case 'server':
        conflict.resolution = 'server';
        conflict.resolvedData = conflict.serverData;
        break;
      case 'timestamp':
        conflict.resolution = conflict.clientData.timestamp > conflict.serverData.timestamp ? 'client' : 'server';
        conflict.resolvedData = conflict.resolution === 'client' ? conflict.clientData : conflict.serverData;
        break;
      case 'manual':
        conflict.resolution = 'manual';
        this.conflictQueue.push(conflict);
        this.emit('conflict_detected', conflict);
        return;
  }

    // Save resolved data
    await this.sendToServer(conflict.resolvedData);
    this.emit('conflict_resolved', conflict);
}

  /**
   * Send to server
   */
  private async sendToServer(data: AutoSaveData): Promise<void> {
    // Simulate server save
    await new Promise(resolve => setTimeout(resolve, 100));
}

  /**
   * Get server data
   */
  private async getServerData(id: string): Promise<AutoSaveData | null> {
    // Simulate server fetch
    return null;
}

  /**
   * Create backup
   */
  private createBackup(): void {
    if (!this.config.enableBackup) return;

    try {
      const backup = {
        timestamp: Date.now(),
        data: this.saveQueue,
        state: this.state,
        version: this.state.currentVersion
    };

      // Mirror to server KV and local fallback
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'autosave_backup', value: backup })
      }).catch(() => {});
      localStorage.setItem('autosave_backup', JSON.stringify(backup));
      this.emit('backup_created', { timestamp: backup.timestamp });
  } catch (error) {
      console.error('Failed to create backup: ', error);
  }
}

  /**
   * Restore from backup
   */
  restoreFromBackup(): boolean {
    try {
      let raw: any = null;
      // Server-first
      // Note: sync call not possible; perform async fetch best-effort using navigator.sendBeacon is overkill; fallback directly
      const stored = localStorage.getItem('autosave_backup');
      raw = stored;
      if (!raw) return false;

      const backupData = JSON.parse(raw);
      this.saveQueue = backupData.data || [];
      this.state.queueSize = this.saveQueue.length;
      this.state.pendingChanges = this.saveQueue.length > 0;

      this.emit('backup_restored', { timestamp: backupData.timestamp });
      return true;
  } catch (error) {
      console.error('Failed to restore backup:', error);
      return false;
  }
}

  /**
   * Handle visibility change
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState ==='hidden' && this.state.pendingChanges) {
      this.processSaveQueue();
  }
}

  /**
   * Handle before unload
   */
  private handleBeforeUnload(): void {
    if (this.state.pendingChanges) {
      this.processSaveQueue();
  }
}

  /**
   * Handle blur
   */
  private handleBlur(): void {
    if (this.state.pendingChanges) {
      this.processSaveQueue();
  }
}

  /**
   * Handle online
   */
  private handleOnline(): void {
    if (this.state.pendingChanges) {
      this.processSaveQueue();
  }
}

  /**
   * Handle offline
   */
  private handleOffline(): void {
    // Pause auto-save when offline
    this.state.isPaused = true;
}

  /**
   * Compress data
   */
  private compressData(data: any): any {
    if (!this.config.enableCompression) return data;
    
    try {
      return JSON.stringify(data);
  } catch (error) {
      console.error('Failed to compress data:', error);
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
      hash = hash & hash;
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
   * Generate ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
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
          console.error('Error in auto-save event listener:', error);
      }
    });
  }
}

  /**
   * Get state
   */
  getState(): AutoSaveState {
    return { ...this.state };
}

  /**
   * Get configuration
   */
  getConfig(): AutoSaveConfig {
    return { ...this.config };
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoSaveConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart intervals if needed
    if (this.intervalTimeout) {
      clearInterval(this.intervalTimeout);
      this.setupIntervals();
  }
}

  /**
   * Pause auto-save
   */
  pause(): void {
    this.state.isPaused = true;
    this.emit('paused');
}

  /**
   * Resume auto-save
   */
  resume(): void {
    this.state.isPaused = false;
    this.emit('resumed');
}

  /**
   * Force save
   */
  async forceSave(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
  }
    await this.processSaveQueue();
}

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.saveQueue = [];
    this.state.queueSize = 0;
    this.state.pendingChanges = false;
    this.emit('queue_cleared');
}

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
  }
    if (this.intervalTimeout) {
      clearInterval(this.intervalTimeout);
  }
    if (this.backupTimeout) {
      clearInterval(this.backupTimeout);
  }

    this.saveQueue = [];
    this.conflictQueue = [];
    this.eventListeners.clear();
    this.state.isEnabled = false;
}
}

// Create singleton instance
export const autoSaveManager = new AutoSaveManager();

export default autoSaveManager;





