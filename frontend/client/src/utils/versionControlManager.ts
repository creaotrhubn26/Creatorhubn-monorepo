/**
 * Version Control Manager
 * Manages version control and change tracking
 */

export interface VersionControlConfig {
  enableVersionControl: boolean;
  enableChangeTracking: boolean;
  enableBranching: boolean;
  enableMerging: boolean;
  enableRollback: boolean;
  enableDiff: boolean;
  enableHistory: boolean;
  enableTags: boolean;
  enableCommits: boolean;
  enableStaging: boolean;
  maxVersions: number;
  maxBranches: number;
  maxCommits: number;
  maxTags: number;
  autoCommit: boolean;
  autoCommitInterval: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
  enableBackup: boolean;
  backupInterval: number;
  enableSync: boolean;
  syncInterval: number;
  debug: boolean;
}

export interface Version {
  id: string;
  number: number;
  name: string;
  description?: string;
  type: 'major' | 'minor' | 'patch' | 'hotfix' | 'feature' | 'custom';
  data: any;
  metadata: {
    size: number;
    checksum: string;
    compressed: boolean;
    encrypted: boolean;
    timestamp: number;
    userId: string;
    sessionId: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
};
  changes: Change[];
  parent?: string;
  children: string[];
  tags: string[];
  branch: string;
  commit?: string;
  isStaged: boolean;
  isCommitted: boolean;
  isPublished: boolean;
  isArchived: boolean;
}

export interface Change {
  id: string;
  type: 'create' | 'update' | 'delete' | 'move' | 'copy' | 'rename' | 'merge' | 'split';
  path: string;
  oldValue?: any;
  newValue?: any;
  timestamp: number;
  userId: string;
  sessionId: string;
  elementId?: string;
  pageId?: string;
  projectId?: string;
  description?: string;
  metadata: {
    size: number;
    checksum: string;
    compressed: boolean;
    encrypted: boolean;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
};
}

export interface Branch {
  id: string;
  name: string;
  description?: string;
  baseVersion: string;
  currentVersion: string;
  isActive: boolean;
  isProtected: boolean;
  isMerged: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy: string;
  metadata: {
    size: number;
    changes: number;
    commits: number;
    tags: number;
};
}

export interface Commit {
  id: string;
  message: string;
  description?: string;
  author: string;
  timestamp: number;
  version: string;
  branch: string;
  changes: string[];
  metadata: {
    size: number;
    checksum: string;
    compressed: boolean;
    encrypted: boolean;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
};
  tags: string[];
  isStaged: boolean;
  isCommitted: boolean;
  isPublished: boolean;
  isArchived: boolean;
}

export interface Tag {
  id: string;
  name: string;
  description?: string;
  version: string;
  commit?: string;
  branch: string;
  type: 'release' | 'milestone' | 'feature' | 'hotfix' | 'custom';
  color?: string;
  createdAt: number;
  createdBy: string;
  metadata: {
    size: number;
    changes: number;
    commits: number;
};
}

export interface Diff {
  id: string;
  fromVersion: string;
  toVersion: string;
  changes: Change[];
  summary: {
    added: number;
    modified: number;
    deleted: number;
    moved: number;
    copied: number;
    renamed: number;
    merged: number;
    split: number;
};
  timestamp: number;
  userId: string;
  sessionId: string;
  metadata: {
    size: number;
    checksum: string;
    compressed: boolean;
    encrypted: boolean;
};
}

export interface VersionControlState {
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  currentVersion: Version | null;
  currentBranch: Branch | null;
  currentCommit: Commit | null;
  versions: Map<string, Version>;
  branches: Map<string, Branch>;
  commits: Map<string, Commit>;
  tags: Map<string, Tag>;
  diffs: Map<string, Diff>;
  stagedChanges: Change[];
  unstagedChanges: Change[];
  changeQueue: Change[];
  lastCommit: number;
  lastSync: number;
  totalVersions: number;
  totalBranches: number;
  totalCommits: number;
  totalTags: number;
  totalChanges: number;
  totalDiffs: number;
  errorCount: number;
}

class VersionControlManager {
  private config: VersionControlConfig;
  private state: VersionControlState;
  private eventListeners: Map<string, Function[]> = new Map();
  private autoCommitInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private backupInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: Partial<VersionControlConfig> = {}) {
    this.config = {
      enableVersionControl: true,
      enableChangeTracking: true,
      enableBranching: true,
      enableMerging: true,
      enableRollback: true,
      enableDiff: true,
      enableHistory: true,
      enableTags: true,
      enableCommits: true,
      enableStaging: true,
      maxVersions: 100,
      maxBranches: 50,
      maxCommits: 1000,
      maxTags: 100,
      autoCommit: true,
      autoCommitInterval: 300000, // 5 minutes
      enableCompression: true,
      enableEncryption: false,
      enableBackup: true,
      backupInterval: 600000, // 10 minutes
      enableSync: true,
      syncInterval: 300000, // 5 minutes
      debug: false,
      ...config
  };

    this.state = {
      isEnabled: false,
      isInitialized: false,
      hasError: false,
      error: null,
      currentVersion: null,
      currentBranch: null,
      currentCommit: null,
      versions: new Map(),
      branches: new Map(),
      commits: new Map(),
      tags: new Map(),
      diffs: new Map(),
      stagedChanges: [],
      unstagedChanges: [],
      changeQueue: [],
      lastCommit: 0,
      lastSync: 0,
      totalVersions: 0,
      totalBranches: 0,
      totalCommits: 0,
      totalTags: 0,
      totalChanges: 0,
      totalDiffs: 0,
      errorCount: 0
  };

    this.initializeVersionControl();
}

  /**
   * Initialize version control
   */
  private initializeVersionControl(): void {
    if (!this.config.enableVersionControl) return;

    try {
      this.setupEventListeners();
      this.setupIntervals();
      this.createInitialVersion();
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
    if (!this.config.enableVersionControl) return;

    // Page visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Before unload
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    // Online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
}

  /**
   * Setup intervals
   */
  private setupIntervals(): void {
    // Auto commit
    if (this.config.autoCommit) {
      this.autoCommitInterval = setInterval(() => {
        this.autoCommit();
    }, this.config.autoCommitInterval);
  }

    // Sync
    if (this.config.enableSync) {
      this.syncInterval = setInterval(() => {
        this.sync();
    }, this.config.syncInterval);
  }

    // Backup
    if (this.config.enableBackup) {
      this.backupInterval = setInterval(() => {
        this.createBackup();
    }, this.config.backupInterval);
  }
}

  /**
   * Create initial version
   */
  private createInitialVersion(): void {
    const version: Version = {
      id: this.generateId(),
      number: 1,
      name: 'Initial Version',
      description: 'Initial version of the project',
      type: 'major',
      data: {},
      metadata: {
        size: 0,
        checksum: this.calculateChecksum({}),
        compressed: false,
        encrypted: false,
        timestamp: Date.now(),
        userId: 'system',
        sessionId: this.generateSessionId()
    },
      changes: [],
      children: [],
      tags: [],
      branch: 'main',
      isStaged: false,
      isCommitted: true,
      isPublished: false,
      isArchived: false
  };

    this.state.versions.set(version.id, version);
    this.state.currentVersion = version;
    this.state.totalVersions = 1;

    // Create main branch
    const branch: Branch = {
      id: this.generateId(),
      name: 'main',
      description: 'Main branch',
      baseVersion: version.id,
      currentVersion: version.id,
      isActive: true,
      isProtected: true,
      isMerged: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'system',
      updatedBy: 'system',
      metadata: {
        size: 0,
        changes: 0,
        commits: 0,
        tags: 0
    }
  };

    this.state.branches.set(branch.id, branch);
    this.state.currentBranch = branch;
    this.state.totalBranches = 1;

    this.emit('version_created', { version });
    this.emit('branch_created', { branch });
}

  /**
   * Create new version
   */
  createVersion(data: any, metadata: Record<string, any> = {}): Version {
    if (!this.state.isEnabled) throw new Error('Version control is not enabled');

    const version: Version = {
      id: this.generateId(),
      number: this.state.totalVersions + 1,
      name: metadata.name || `Version ${this.state.totalVersions + 1}`,
      description: metadata.description,
      type: metadata.type || 'minor',
      data: this.config.enableCompression ? this.compressData(data) : data,
      metadata: {
        size: this.calculateDataSize(data),
        checksum: this.calculateChecksum(data),
        compressed: this.config.enableCompression,
        encrypted: this.config.enableEncryption,
        timestamp: Date.now(),
        userId: metadata.userId || 'unknown',
        sessionId: metadata.sessionId || this.generateSessionId(),
        deviceId: metadata.deviceId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
    },
      changes: [...this.state.stagedChanges],
      parent: this.state.currentVersion?.id,
      children: [],
      tags: [],
      branch: this.state.currentBranch?.name || 'main',
      isStaged: false,
      isCommitted: false,
      isPublished: false,
      isArchived: false
  };

    // Update parent version
    if (this.state.currentVersion) {
      this.state.currentVersion.children.push(version.id);
      this.state.versions.set(this.state.currentVersion.id, this.state.currentVersion);
  }

    // Update current branch
    if (this.state.currentBranch) {
      this.state.currentBranch.currentVersion = version.id;
      this.state.currentBranch.updatedAt = Date.now();
      this.state.branches.set(this.state.currentBranch.id, this.state.currentBranch);
  }

    this.state.versions.set(version.id, version);
    this.state.currentVersion = version;
    this.state.totalVersions++;
    this.state.stagedChanges = [];

    this.emit('version_created', { version });
    return version;
}

  /**
   * Track change
   */
  trackChange(change: Change): void {
    if (!this.state.isEnabled) return;

    this.state.unstagedChanges.push(change);
    this.state.changeQueue.push(change);
    this.state.totalChanges++;

    this.emit('change_tracked', { change });
}

  /**
   * Stage changes
   */
  stageChanges(changeIds: string[]): void {
    if (!this.state.isEnabled) return;

    const changesToStage = this.state.unstagedChanges.filter(change => 
      changeIds.includes(change.id)
    );

    this.state.stagedChanges.push(...changesToStage);
    this.state.unstagedChanges = this.state.unstagedChanges.filter(change => 
      !changeIds.includes(change.id)
    );

    this.emit('changes_staged', { changes: changesToStage });
}

  /**
   * Unstage changes
   */
  unstageChanges(changeIds: string[]): void {
    if (!this.state.isEnabled) return;

    const changesToUnstage = this.state.stagedChanges.filter(change => 
      changeIds.includes(change.id)
    );

    this.state.unstagedChanges.push(...changesToUnstage);
    this.state.stagedChanges = this.state.stagedChanges.filter(change => 
      !changeIds.includes(change.id)
    );

    this.emit('changes_unstaged', { changes: changesToUnstage });
}

  /**
   * Create commit
   */
  createCommit(message: string, description?: string, metadata: Record<string, any> = {}): Commit {
    if (!this.state.isEnabled) throw new Error('Version control is not enabled');

    const commit: Commit = {
      id: this.generateId(),
      message,
      description,
      author: metadata.author || 'unknown',
      timestamp: Date.now(),
      version: this.state.currentVersion?.id || ', ',
      branch: this.state.currentBranch?.name || 'main',
      changes: this.state.stagedChanges.map(change => change.id),
      metadata: {
        size: this.calculateDataSize(this.state.stagedChanges),
        checksum: this.calculateChecksum(this.state.stagedChanges),
        compressed: this.config.enableCompression,
        encrypted: this.config.enableEncryption,
        deviceId: metadata.deviceId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
    },
      tags: [],
      isStaged: false,
      isCommitted: true,
      isPublished: false,
      isArchived: false
  };

    this.state.commits.set(commit.id, commit);
    this.state.currentCommit = commit;
    this.state.totalCommits++;
    this.state.lastCommit = Date.now();

    // Update current version
    if (this.state.currentVersion) {
      this.state.currentVersion.isCommitted = true;
      this.state.versions.set(this.state.currentVersion.id, this.state.currentVersion);
  }

    this.emit('commit_created', { commit });
    return commit;
}

  /**
   * Create branch
   */
  createBranch(name: string, description?: string, baseVersion?: string): Branch {
    if (!this.state.isEnabled) throw new Error('Version control is not enabled');

    const branch: Branch = {
      id: this.generateId(),
      name,
      description,
      baseVersion: baseVersion || this.state.currentVersion?.id || ', ',
      currentVersion: baseVersion || this.state.currentVersion?.id || ', ',
      isActive: false,
      isProtected: false,
      isMerged: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'unknown',
      updatedBy: 'unknown',
      metadata: {
        size: 0,
        changes: 0,
        commits: 0,
        tags: 0
    }
  };

    this.state.branches.set(branch.id, branch);
    this.state.totalBranches++;

    this.emit('branch_created', { branch });
    return branch;
}

  /**
   * Switch branch
   */
  switchBranch(branchId: string): void {
    if (!this.state.isEnabled) return;

    const branch = this.state.branches.get(branchId);
    if (!branch) throw new Error('Branch not found');

    // Deactivate current branch
    if (this.state.currentBranch) {
      this.state.currentBranch.isActive = false;
      this.state.branches.set(this.state.currentBranch.id, this.state.currentBranch);
  }

    // Activate new branch
    branch.isActive = true;
    this.state.currentBranch = branch;
    this.state.branches.set(branch.id, branch);

    // Switch to branch's current version
    const version = this.state.versions.get(branch.currentVersion);
    if (version) {
      this.state.currentVersion = version;
  }

    this.emit('branch_switched', { branch });
}

  /**
   * Merge branch
   */
  mergeBranch(sourceBranchId: string, targetBranchId: string, strategy: 'fast-forward' | 'merge' | 'squash' = 'merge'): void {
    if (!this.state.isEnabled) return;

    const sourceBranch = this.state.branches.get(sourceBranchId);
    const targetBranch = this.state.branches.get(targetBranchId);
    
    if (!sourceBranch || !targetBranch) throw new Error('Branch not found');

    // Mark source branch as merged
    sourceBranch.isMerged = true;
    this.state.branches.set(sourceBranch.id, sourceBranch);

    // Update target branch
    targetBranch.currentVersion = sourceBranch.currentVersion;
    targetBranch.updatedAt = Date.now();
    this.state.branches.set(targetBranch.id, targetBranch);

    this.emit('branch_merged', { sourceBranch, targetBranch, strategy });
}

  /**
   * Create tag
   */
  createTag(name: string, versionId: string, type: 'release' | 'milestone' | 'feature' | 'hotfix' | 'custom' = 'custom', description?: string): Tag {
    if (!this.state.isEnabled) throw new Error('Version control is not enabled');

    const tag: Tag = {
      id: this.generateId(),
      name,
      description,
      version: versionId,
      branch: this.state.currentBranch?.name || 'main',
      type,
      createdAt: Date.now(),
      createdBy: 'unknown',
      metadata: {
        size: 0,
        changes: 0,
        commits: 0
    }
  };

    this.state.tags.set(tag.id, tag);
    this.state.totalTags++;

    // Add tag to version
    const version = this.state.versions.get(versionId);
    if (version) {
      version.tags.push(tag.id);
      this.state.versions.set(version.id, version);
  }

    this.emit('tag_created', { tag });
    return tag;
}

  /**
   * Create diff
   */
  createDiff(fromVersionId: string, toVersionId: string): Diff {
    if (!this.state.isEnabled) throw new Error('Version control is not enabled');

    const fromVersion = this.state.versions.get(fromVersionId);
    const toVersion = this.state.versions.get(toVersionId);
    
    if (!fromVersion || !toVersion) throw new Error('Version not found');

    const changes = this.calculateChanges(fromVersion, toVersion);
    const summary = this.calculateSummary(changes);

    const diff: Diff = {
      id: this.generateId(),
      fromVersion: fromVersionId,
      toVersion: toVersionId,
      changes,
      summary,
      timestamp: Date.now(),
      userId: 'unknown',
      sessionId: this.generateSessionId(),
      metadata: {
        size: this.calculateDataSize(changes),
        checksum: this.calculateChecksum(changes),
        compressed: this.config.enableCompression,
        encrypted: this.config.enableEncryption
    }
  };

    this.state.diffs.set(diff.id, diff);
    this.state.totalDiffs++;

    this.emit('diff_created', { diff });
    return diff;
}

  /**
   * Rollback to version
   */
  rollbackToVersion(versionId: string): void {
    if (!this.state.isEnabled) return;

    const version = this.state.versions.get(versionId);
    if (!version) throw new Error('Version not found');

    this.state.currentVersion = version;
    this.state.lastSync = Date.now();

    this.emit('version_rollback', { version });
}

  /**
   * Calculate changes between versions
   */
  private calculateChanges(fromVersion: Version, toVersion: Version): Change[] {
    // Implementation depends on data structure
    return [];
}

  /**
   * Calculate summary of changes
   */
  private calculateSummary(changes: Change[]): any {
    return {
      added: changes.filter(c => c.type === 'create').length,
      modified: changes.filter(c => c.type === 'update').length,
      deleted: changes.filter(c => c.type === 'delete').length,
      moved: changes.filter(c => c.type === 'move').length,
      copied: changes.filter(c => c.type === 'copy').length,
      renamed: changes.filter(c => c.type === 'rename').length,
      merged: changes.filter(c => c.type === 'merge').length,
      split: changes.filter(c => c.type === 'split').length
  };
}

  /**
   * Auto commit
   */
  private autoCommit(): void {
    if (this.state.stagedChanges.length === 0) return;

    try {
      this.createCommit('Auto commit', 'Automatically committed changes');
  } catch (error) {
      this.state.errorCount++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { error: this.state.error });
  }
}

  /**
   * Sync
   */
  private async sync(): Promise<void> {
    if (!this.config.enableSync) return;

    try {
      // Implementation depends on sync strategy
      this.state.lastSync = Date.now();
      this.emit('sync_completed');
  } catch (error) {
      this.state.errorCount++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { error: this.state.error });
  }
}

  /**
   * Create backup
   */
  private createBackup(): void {
    if (!this.config.enableBackup) return;

    try {
      const backup = {
        timestamp: Date.now(),
        versions: Array.from(this.state.versions.values()),
        branches: Array.from(this.state.branches.values()),
        commits: Array.from(this.state.commits.values()),
        tags: Array.from(this.state.tags.values()),
        state: this.state
      };

      // Mirror to server KV
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'version_control_backup', value: backup })
      }).catch(() => {});

      localStorage.setItem('version_control_backup', JSON.stringify(backup));
      this.emit('backup_created', { timestamp: backup.timestamp });
    } catch (error) {
      console.error('Failed to create backup: ', error);
    }
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
   * Generate session ID
   */
  private generateSessionId(): string {
    return 'session_' + Date.now().toString(36);
}

  /**
   * Handle visibility change
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState ==='hidden') {
      this.createBackup();
  }
}

  /**
   * Handle before unload
   */
  private handleBeforeUnload(): void {
    this.createBackup();
}

  /**
   * Handle online
   */
  private handleOnline(): void {
    this.sync();
}

  /**
   * Handle offline
   */
  private handleOffline(): void {
    // Pause sync when offline
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
          console.error('Error in version control event listener:', error);
      }
    });
  }
}

  /**
   * Get state
   */
  getState(): VersionControlState {
    return { ...this.state };
}

  /**
   * Get configuration
   */
  getConfig(): VersionControlConfig {
    return { ...this.config };
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<VersionControlConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart intervals if needed
    this.setupIntervals();
}

  /**
   * Get versions
   */
  getVersions(): Version[] {
    return Array.from(this.state.versions.values());
}

  /**
   * Get branches
   */
  getBranches(): Branch[] {
    return Array.from(this.state.branches.values());
}

  /**
   * Get commits
   */
  getCommits(): Commit[] {
    return Array.from(this.state.commits.values());
}

  /**
   * Get tags
   */
  getTags(): Tag[] {
    return Array.from(this.state.tags.values());
}

  /**
   * Get diffs
   */
  getDiffs(): Diff[] {
    return Array.from(this.state.diffs.values());
}

  /**
   * Get staged changes
   */
  getStagedChanges(): Change[] {
    return [...this.state.stagedChanges];
}

  /**
   * Get unstaged changes
   */
  getUnstagedChanges(): Change[] {
    return [...this.state.unstagedChanges];
}

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.autoCommitInterval) {
      clearInterval(this.autoCommitInterval);
  }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
  }
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
  }

    this.state.versions.clear();
    this.state.branches.clear();
    this.state.commits.clear();
    this.state.tags.clear();
    this.state.diffs.clear();
    this.state.stagedChanges = [];
    this.state.unstagedChanges = [];
    this.state.changeQueue = [];
    this.eventListeners.clear();
    this.state.isEnabled = false;
}
}

// Create singleton instance
export const versionControlManager = new VersionControlManager();

export default versionControlManager;




