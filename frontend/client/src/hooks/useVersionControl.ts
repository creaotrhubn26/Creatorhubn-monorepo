/**
 * useVersionControl Hook
 * React hook for version control and change tracking
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  versionControlManager, 
  VersionControlConfig, 
  VersionControlState, 
  Version,
  Change,
  Branch,
  Commit,
  Tag,
  Diff
} from '../utils/versionControlManager';

export interface UseVersionControlOptions {
  config?: Partial<VersionControlConfig>;
  onVersionCreated?: (data: { version: Version }) => void;
  onVersionUpdated?: (data: { version: Version }) => void;
  onVersionDeleted?: (data: { version: Version }) => void;
  onVersionRollback?: (data: { version: Version }) => void;
  onChangeTracked?: (data: { change: Change }) => void;
  onChangesStaged?: (data: { changes: Change[, ],}) => void;
  onChangesUnstaged?: (data: { changes: Change[, ],}) => void;
  onCommitCreated?: (data: { commit: Commit }) => void;
  onBranchCreated?: (data: { branch: Branch }) => void;
  onBranchSwitched?: (data: { branch: Branch }) => void;
  onBranchMerged?: (data: { sourceBranch: Branch; targetBranch: Branch; strategy: string }) => void;
  onTagCreated?: (data: { tag: Tag }) => void;
  onDiffCreated?: (data: { diff: Diff }) => void;
  onBackupCreated?: (data: { timestamp: number }) => void;
  onSyncCompleted?: () => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UseVersionControlReturn {
  createVersion: (data: any, metadata?: Record<string, any>) => Version;
  trackChange: (change: Change) => void;
  stageChanges: (changeIds: string[]) => void;
  unstageChanges: (changeIds: string[]) => void;
  createCommit: (message: string, description?: string, metadata?: Record<string, any>) => Commit;
  createBranch: (name: string, description?: string, baseVersion?: string) => Branch;
  switchBranch: (branchId: string) => void;
  mergeBranch: (sourceBranchId: string, targetBranchId: string, strategy?: 'fast-forward' | 'merge' | 'squash') => void;
  createTag: (name: string, versionId: string, type?: 'release' | 'milestone' | 'feature' | 'hotfix' | 'custom', description?: string) => Tag;
  createDiff: (fromVersionId: string, toVersionId: string) => Diff;
  rollbackToVersion: (versionId: string) => void;
  state: VersionControlState;
  config: VersionControlConfig;
  updateConfig: (config: Partial<VersionControlConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  currentVersion: Version | null;
  currentBranch: Branch | null;
  currentCommit: Commit | null;
  versions: Version[];
  branches: Branch[];
  commits: Commit[];
  tags: Tag[];
  diffs: Diff[];
  stagedChanges: Change[];
  unstagedChanges: Change[];
  lastCommit: number;
  lastSync: number;
  totalVersions: number;
  totalBranches: number;
  totalCommits: number;
  totalTags: number;
  totalChanges: number;
  totalDiffs: number
}

/**
 * Hook for version control functionality
 */
export const useVersionControl = (options: UseVersionControlOptions = {}): UseVersionControlReturn => {
  const {
    config = {},
    onVersionCreated,
    onVersionUpdated,
    onVersionDeleted,
    onVersionRollback,
    onChangeTracked,
    onChangesStaged,
    onChangesUnstaged,
    onCommitCreated,
    onBranchCreated,
    onBranchSwitched,
    onBranchMerged,
    onTagCreated,
    onDiffCreated,
    onBackupCreated,
    onSyncCompleted,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<VersionControlState>({
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
    stagedChanges:  [],
    unstagedChanges:  [],
    changeQueue:  [],
    lastCommit:  0,
    lastSync:  0,
    totalVersions:  0,
    totalBranches:  0,
    totalCommits:  0,
    totalTags:  0,
    totalChanges:  0,
    totalDiffs: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize version control manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      versionControlManager.updateConfig(config);
  }

    // Setup event handlers
    const handleVersionCreated = (data: { version: Version }) => {
      if (onVersionCreated) {
        onVersionCreated(data);
    }
  };

    const handleVersionUpdated = (data: { version: Version }) => {
      if (onVersionUpdated) {
        onVersionUpdated(data);
    }
  };

    const handleVersionDeleted = (data: { version: Version }) => {
      if (onVersionDeleted) {
        onVersionDeleted(data);
    }
  };

    const handleVersionRollback = (data: { version: Version }) => {
      if (onVersionRollback) {
        onVersionRollback(data);
    }
  };

    const handleChangeTracked = (data: { change: Change }) => {
      if (onChangeTracked) {
        onChangeTracked(data);
    }
  };

    const handleChangesStaged = (data: { changes: Change[, ],}) => {
      if (onChangesStaged) {
        onChangesStaged(data);
    }
  };

    const handleChangesUnstaged = (data: { changes: Change[, ],}) => {
      if (onChangesUnstaged) {
        onChangesUnstaged(data);
    }
  };

    const handleCommitCreated = (data: { commit: Commit }) => {
      if (onCommitCreated) {
        onCommitCreated(data);
    }
  };

    const handleBranchCreated = (data: { branch: Branch }) => {
      if (onBranchCreated) {
        onBranchCreated(data);
    }
  };

    const handleBranchSwitched = (data: { branch: Branch }) => {
      if (onBranchSwitched) {
        onBranchSwitched(data);
    }
  };

    const handleBranchMerged = (data: { sourceBranch: Branch; targetBranch: Branch; strategy: string }) => {
      if (onBranchMerged) {
        onBranchMerged(data);
    }
  };

    const handleTagCreated = (data: { tag: Tag }) => {
      if (onTagCreated) {
        onTagCreated(data);
    }
  };

    const handleDiffCreated = (data: { diff: Diff }) => {
      if (onDiffCreated) {
        onDiffCreated(data);
    }
  };

    const handleBackupCreated = (data: { timestamp: number }) => {
      if (onBackupCreated) {
        onBackupCreated(data);
    }
  };

    const handleSyncCompleted = () => {
      if (onSyncCompleted) {
        onSyncCompleted();
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
    eventHandlersRef.current.set('version_created', handleVersionCreated);
    eventHandlersRef.current.set('version_updated', handleVersionUpdated);
    eventHandlersRef.current.set('version_deleted', handleVersionDeleted);
    eventHandlersRef.current.set('version_rollback', handleVersionRollback);
    eventHandlersRef.current.set('change_tracked', handleChangeTracked);
    eventHandlersRef.current.set('changes_staged', handleChangesStaged);
    eventHandlersRef.current.set('changes_unstaged', handleChangesUnstaged);
    eventHandlersRef.current.set('commit_created', handleCommitCreated);
    eventHandlersRef.current.set('branch_created', handleBranchCreated);
    eventHandlersRef.current.set('branch_switched', handleBranchSwitched);
    eventHandlersRef.current.set('branch_merged', handleBranchMerged);
    eventHandlersRef.current.set('tag_created', handleTagCreated);
    eventHandlersRef.current.set('diff_created', handleDiffCreated);
    eventHandlersRef.current.set('backup_created', handleBackupCreated);
    eventHandlersRef.current.set('sync_completed', handleSyncCompleted);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    versionControlManager.on('version_created', handleVersionCreated);
    versionControlManager.on('version_updated', handleVersionUpdated);
    versionControlManager.on('version_deleted', handleVersionDeleted);
    versionControlManager.on('version_rollback', handleVersionRollback);
    versionControlManager.on('change_tracked', handleChangeTracked);
    versionControlManager.on('changes_staged', handleChangesStaged);
    versionControlManager.on('changes_unstaged', handleChangesUnstaged);
    versionControlManager.on('commit_created', handleCommitCreated);
    versionControlManager.on('branch_created', handleBranchCreated);
    versionControlManager.on('branch_switched', handleBranchSwitched);
    versionControlManager.on('branch_merged', handleBranchMerged);
    versionControlManager.on('tag_created', handleTagCreated);
    versionControlManager.on('diff_created', handleDiffCreated);
    versionControlManager.on('backup_created', handleBackupCreated);
    versionControlManager.on('sync_completed', handleSyncCompleted);
    versionControlManager.on('error', handleError);
    versionControlManager.on('initialized', handleInitialized);

    // Update initial state
    setState(versionControlManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        versionControlManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onVersionCreated, onVersionUpdated, onVersionDeleted, onVersionRollback, onChangeTracked, onChangesStaged, onChangesUnstaged, onCommitCreated, onBranchCreated, onBranchSwitched, onBranchMerged, onTagCreated, onDiffCreated, onBackupCreated, onSyncCompleted, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = versionControlManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Create version
  const createVersion = useCallback((data: any, metadata: Record<string, any> = {}) => {
    return versionControlManager.createVersion(data, metadata);
}, []);

  // Track change
  const trackChange = useCallback((change: Change) => {
    versionControlManager.trackChange(change);
}, []);

  // Stage changes
  const stageChanges = useCallback((changeIds: string[]) => {
    versionControlManager.stageChanges(changeIds);
}, []);

  // Unstage changes
  const unstageChanges = useCallback((changeIds: string[]) => {
    versionControlManager.unstageChanges(changeIds);
}, []);

  // Create commit
  const createCommit = useCallback((message: string, description?: string, metadata: Record<string, any> = {}) => {
    return versionControlManager.createCommit(message, description, metadata);
}, []);

  // Create branch
  const createBranch = useCallback((name: string, description?: string, baseVersion?: string) => {
    return versionControlManager.createBranch(name, description, baseVersion);
}, []);

  // Switch branch
  const switchBranch = useCallback((branchId: string) => {
    versionControlManager.switchBranch(branchId);
}, []);

  // Merge branch
  const mergeBranch = useCallback((sourceBranchId: string, targetBranchId: string, strategy: 'fast-forward' | 'merge' | 'squash' = 'merge') => {
    versionControlManager.mergeBranch(sourceBranchd, targetBranchId, strategy);
}, []);

  // Create tag
  const createTag = useCallback((name: string, versionId: string, type: 'release' | 'milestone' | 'feature' | 'hotfix' | 'custom' ='custom', description?: string) => {
    return versionControlManager.createTag(name, versionId, type, description);
}, []);

  // Create diff
  const createDiff = useCallback((fromVersionId: string, toVersionId: string) => {
    return versionControlManager.createDiff(fromVersiond, toVersionId);
}, []);

  // Rollback to version
  const rollbackToVersion = useCallback((versionId: string) => {
    versionControlManager.rollbackToVersion(versionId);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<VersionControlConfig>) => {
    versionControlManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const config = useMemo(() => {
    return versionControlManager.getConfig();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    createVersion,
    trackChange,
    stageChanges,
    unstageChanges,
    createCommit,
    createBranch,
    switchBranch,
    mergeBranch,
    createTag,
    createDiff,
    rollbackToVersion,
    state,
    config,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    currentVersion: state.currentVersion,
    currentBranch: state.currentBranch,
    currentCommit: state.currentCommit,
    versions: Array.from(state.versions.values(, ), ),
    branches: Array.from(state.branches.values(, ), ),
    commits: Array.from(state.commits.values(, ), ),
    tags: Array.from(state.tags.values(, ), ),
    diffs: Array.from(state.diffs.values(, ), ),
    stagedChanges: state.stagedChanges,
    unstagedChanges: state.unstagedChanges,
    lastCommit: state.lastCommit,
    lastSync: state.lastSync,
    totalVersions: state.totalVersions,
    totalBranches: state.totalBranches,
    totalCommits: state.totalCommits,
    totalTags: state.totalTags,
    totalChanges: state.totalChanges,
    totalDiffs: state.totalDiffs
}), [
    createVersion,
    trackChange,
    stageChanges,
    unstageChanges,
    createCommit,
    createBranch,
    switchBranch,
    mergeBranch,
    createTag,
    createDiff,
    rollbackToVersion,
    state,
    config,
    updateConfig
  ]);

  return returnValue;
};

export default useVersionControl;





