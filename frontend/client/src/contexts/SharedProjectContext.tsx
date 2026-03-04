/**
 * SharedProjectContext
 *
 * Unified project state management across all components:
 * - PhotographerPhotoSuite
 * - UniversalShowcase
 * - StoryArcStudio
 * - AudioEnhancementSuite
 *
 * Features:
 * - Real-time asset synchronization
 * - Workflow state management
 * - Cross-component event handling
 * - Persistent state with localStorage
 */

import type {
  ReactNode} from 'react';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  WorkflowState} from '@/services/WorkflowOrchestrator';
import {
  workflowOrchestrator,
  WorkflowComponent,
} from '@/services/WorkflowOrchestrator';
import type {
  CrossComponentEvent} from '@/services/CrossComponentEventBus';
import {
  crossComponentEventBus,
  CrossComponentEventType,
} from '@/services/CrossComponentEventBus';
import type { MediaAsset } from '@/services/UnifiedAssetService';
import { unifiedAssetService } from '@/services/UnifiedAssetService';

// ==========================================
// TYPES
// ==========================================

export interface ProjectMetadata {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'in-progress' | 'review' | 'completed' | 'archived';
  tags?: string[];
  googleDriveFolderId?: string;
}

export interface AssetSyncState {
  loading: boolean;
  syncing: boolean;
  lastSyncTime?: number;
  error?: string;
}

export interface WorkflowTransitionState {
  from?: WorkflowComponent;
  to?: WorkflowComponent;
  timestamp?: number;
  assets?: MediaAsset[];
  metadata?: Record<string, any>;
}

export interface SharedProjectContextValue {
  // Project State
  currentProject: ProjectMetadata | null;
  setCurrentProject: (project: ProjectMetadata | null) => void;

  // Asset State
  projectAssets: MediaAsset[];
  selectedAssets: Set<string>;
  setSelectedAssets: (assets: Set<string>) => void;
  toggleAssetSelection: (assetId: string) => void;
  clearSelection: () => void;

  // Asset Operations
  addAssets: (assets: MediaAsset[]) => Promise<void>;
  updateAsset: (assetId: string, updates: Partial<MediaAsset>) => Promise<void>;
  deleteAssets: (assetIds: string[]) => Promise<void>;
  refreshAssets: () => Promise<void>;

  // Sync State
  syncState: AssetSyncState;

  // Workflow State
  workflowState: WorkflowState | null;
  currentComponent: WorkflowComponent | null;
  lastTransition: WorkflowTransitionState | null;

  // Event Handlers
  subscribeToEvents: (callback: (event: CrossComponentEvent) => void) => () => void;

  // Utilities
  isAssetSelected: (assetId: string) => boolean;
  getAssetById: (assetId: string) => MediaAsset | undefined;
  getAssetsByType: (type: 'photo' | 'video' | 'audio' | 'document') => MediaAsset[];
}

// ==========================================
// CONTEXT
// ==========================================

const SharedProjectContext = createContext<SharedProjectContextValue | undefined>(undefined);

// ==========================================
// PROVIDER
// ==========================================

interface SharedProjectProviderProps {
  children: ReactNode;
}

export function SharedProjectProvider({ children }: SharedProjectProviderProps) {
  const { user } = useAuth();

  // Project State
  const [currentProject, setCurrentProjectState] = useState<ProjectMetadata | null>(null);

  // Load last project from server (fallback to localStorage)
  useEffect(() => {
    fetch('/api/user/ui-preferences', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const lp = j?.data?.last_project;
        if (lp) {
          setCurrentProjectState(lp);
        } else {
          const saved = localStorage.getItem('sharedProject:currentProject');
          if (saved) {
            try { setCurrentProjectState(JSON.parse(saved)); } catch {}
          }
        }
      })
      .catch(() => {
        const saved = localStorage.getItem('sharedProject:currentProject');
        if (saved) {
          try { setCurrentProjectState(JSON.parse(saved)); } catch {}
        }
      });
  }, []);

  // Asset State
  const [projectAssets, setProjectAssets] = useState<MediaAsset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  // Sync State
  const [syncState, setSyncState] = useState<AssetSyncState>({
    loading: false,
    syncing: false,
  });

  // Workflow State
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [currentComponent, setCurrentComponent] = useState<WorkflowComponent | null>(null);
  const [lastTransition, setLastTransition] = useState<WorkflowTransitionState | null>(null);

  // ==========================================
  // PROJECT MANAGEMENT
  // ==========================================

  const setCurrentProject = useCallback((project: ProjectMetadata | null) => {
    setCurrentProjectState(project);

    // Save to DB + localStorage
    fetch('/api/user/ui-preferences', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ lastProject: project }),
    }).catch(() => {});
    if (project) {
      localStorage.setItem('sharedProject:currentProject', JSON.stringify(project));
    } else {
      localStorage.removeItem('sharedProject:currentProject');
    }

    // Refresh assets when project changes
    if (project) {
      refreshAssets();
    } else {
      setProjectAssets([]);
      setSelectedAssets(new Set());
    }
  }, []);

  // ==========================================
  // ASSET OPERATIONS
  // ==========================================

  const refreshAssets = useCallback(async () => {
    if (!currentProject || !user) return;

    setSyncState((prev) => ({ ...prev, loading: true, error: undefined }));

    try {
      const assets = await unifiedAssetService.getProjectAssets(currentProject.id);
      setProjectAssets(assets);

      setSyncState((prev) => ({
        ...prev,
        loading: false,
        lastSyncTime: Date.now(),
      }));
    } catch (error) {
      console.error('Failed to refresh assets: ', error);
      setSyncState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load assets',
      }));
    }
  }, [currentProject, user]);

  const addAssets = useCallback(
    async (assets: MediaAsset[]) => {
      if (!currentProject || !user) return;

      setSyncState((prev) => ({ ...prev, syncing: true }));

      try {
        // Add assets through UnifiedAssetService
        for (const asset of assets) {
          await unifiedAssetService.linkToProject(asset.id, currentProject.id);
        }

        // Refresh to get updated list
        await refreshAssets();

        // Publish event
        crossComponentEventBus.publish(
          CrossComponentEventType.PROJECT_ASSET_LINKED,
          currentComponent || WorkflowComponent.UNIVERSAL_SHOWCASE,
          user.id,
          { projectId: currentProject.id, assets },
        );

        setSyncState((prev) => ({ ...prev, syncing: false }));
      } catch (error) {
        console.error('Failed to add assets:', error);
        setSyncState((prev) => ({ ...prev, syncing: false }));
        throw error;
      }
    },
    [currentProject, user, currentComponent, refreshAssets],
  );

  const updateAsset = useCallback(
    async (assetId: string, updates: Partial<MediaAsset>) => {
      if (!user) return;

      try {
        await unifiedAssetService.updateAsset(assetId, updates);

        // Update local state
        setProjectAssets((prev) =>
          prev.map((asset) => (asset.id === assetId ? { ...asset, ...updates } : asset)),
        );

        // Event is published by UnifiedAssetService
      } catch (error) {
        console.error('Failed to update asset:', error);
        throw error;
      }
    },
    [user],
  );

  const deleteAssets = useCallback(
    async (assetIds: string[]) => {
      if (!user) return;

      try {
        await unifiedAssetService.batchDeleteAssets(assetIds);

        // Update local state
        setProjectAssets((prev) => prev.filter((asset) => !assetIds.includes(asset.id)));
        setSelectedAssets((prev) => {
          const newSet = new Set(prev);
          assetIds.forEach((id) => newSet.delete(id));
          return newSet;
        });

        // Event is published by UnifiedAssetService
      } catch (error) {
        console.error('Failed to delete assets:', error);
        throw error;
      }
    },
    [user],
  );

  // ==========================================
  // SELECTION MANAGEMENT
  // ==========================================

  const toggleAssetSelection = useCallback((assetId: string) => {
    setSelectedAssets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedAssets(new Set());
  }, []);

  const isAssetSelected = useCallback(
    (assetId: string) => {
      return selectedAssets.has(assetId);
    },
    [selectedAssets],
  );

  // ==========================================
  // UTILITIES
  // ==========================================

  const getAssetById = useCallback(
    (assetId: string) => {
      return projectAssets.find((asset) => asset.id === assetId);
    },
    [projectAssets],
  );

  const getAssetsByType = useCallback(
    (type: 'photo' | 'video' | 'audio' |'document') => {
      return projectAssets.filter((asset) => asset.type === type);
    },
    [projectAssets],
  );

  // ==========================================
  // EVENT HANDLING
  // ==========================================

  const subscribeToEvents = useCallback((callback: (event: CrossComponentEvent) => void) => {
    return crossComponentEventBus.onAny(callback);
  }, []);

  // Subscribe to asset events
  useEffect(() => {
    const unsubscribe = crossComponentEventBus.onAny((event) => {
      // Handle asset updates
      if (
        event.type === CrossComponentEventType.ASSET_CREATED ||
        event.type === CrossComponentEventType.ASSET_UPDATED ||
        event.type === CrossComponentEventType.ASSET_DELETED
      ) {
        refreshAssets();
      }

      // Handle workflow transitions
      if (event.type === CrossComponentEventType.WORKFLOW_TRANSITION) {
        const transition = event.data as WorkflowTransitionState;
        setLastTransition(transition);
        setCurrentComponent(transition.to || null);
      }
    });

    return unsubscribe;
  }, [refreshAssets]);

  // Subscribe to workflow state changes
  useEffect(() => {
    const checkWorkflowState = () => {
      const state = workflowOrchestrator.getCurrentWorkflow();
      setWorkflowState(state);

      if (state) {
        setCurrentComponent(state.targetComponent);
      }
    };

    // Check initially
    checkWorkflowState();

    // Check every 5 seconds (workflow state can change externally)
    const interval = setInterval(checkWorkflowState, 5000);

    return () => clearInterval(interval);
  }, []);

  // Restore project from localStorage on mount
  useEffect(() => {
    const savedProject = localStorage.getItem('sharedProject:currentProject');
    if (savedProject) {
      try {
        const project = JSON.parse(savedProject);
        setCurrentProjectState(project);
        refreshAssets();
      } catch (error) {
        console.error('Failed to restore project:', error);
      }
    }
  }, []);

  // Auto-refresh assets every 30 seconds
  useEffect(() => {
    if (!currentProject) return;

    const interval = setInterval(() => {
      refreshAssets();
    }, 30000);

    return () => clearInterval(interval);
  }, [currentProject, refreshAssets]);

  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const value: SharedProjectContextValue = {
    currentProject,
    setCurrentProject,
    projectAssets,
    selectedAssets,
    setSelectedAssets,
    toggleAssetSelection,
    clearSelection,
    addAssets,
    updateAsset,
    deleteAssets,
    refreshAssets,
    syncState,
    workflowState,
    currentComponent,
    lastTransition,
    subscribeToEvents,
    isAssetSelected,
    getAssetById,
    getAssetsByType,
  };

  return <SharedProjectContext.Provider value={value}>{children}</SharedProjectContext.Provider>;
}

// ==========================================
// HOOK
// ==========================================

export function useSharedProject() {
  const context = useContext(SharedProjectContext);
  if (!context) {
    throw new Error('useSharedProject must be used within SharedProjectProvider');
  }
  return context;
}

// ==========================================
// EXPORTS
// ==========================================

export default SharedProjectContext;
