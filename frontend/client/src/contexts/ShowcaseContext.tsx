// @ts-nocheck
/**
 * ShowcaseContext - Unified Showcase State Management
 * Bridges UniversalDashboard and UniversalShowcase with shared state
 */

import type {
  ReactNode} from 'react';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect
} from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';

interface ShowcaseSettings {
  // Display Settings
  viewMode: 'grid' | 'list' | 'masonry';
  cardSize: 'small' | 'medium' | 'large' | 'extra-large';
  cardBackground: 'dark' | 'light' | 'transparent' | 'gradient';
  cardBorderRadius: 'none' | 'small' | 'medium' | 'large';
  cardShadow: 'none' | 'subtle' | 'medium' | 'strong';
  imageQuality: 'low' | 'medium' | 'high' | 'original';
  imageAspectRatio: 'square' | '16:9' | '4:3' | '3:2' | 'original';

  // Interaction Settings
  clickAction: 'fullscreen' | 'download' | 'select' | 'custom';
  doubleClickAction: 'fullscreen' | 'download' | 'select';
  hoverEffects: 'none' | 'glow' | 'scale' | 'fade';
  animationSpeed: 'disabled' | 'slow' | 'normal' | 'fast';

  // Feature Toggles
  showSelectionButton: boolean;
  showFavoriteButton: boolean;
  showCommentButton: boolean;
  showDownloadButton: boolean;
  showShareButton: boolean;
  keyboardShortcuts: boolean;
  lazyLoading: boolean;
  viewTracking: boolean;
  analyticsTracking: boolean;
  soundEffects: boolean;

  // Watermark Settings
  watermark: 'none' | 'text' | 'logo' | 'both';
  watermarkText: string;
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  watermarkSize: 'small' | 'medium' | 'large';
  watermarkOpacity: number;

  // Audio Settings (for music producers)
  audioWatermarkEnabled: boolean;

  // Mobile Settings
  mobileButtonSize: 'small' | 'medium' | 'large';
  buttonStyle: 'filled' | 'outlined' | 'text';
}

interface SelectedProject {
  id: string;
  title?: string;
  name?: string;
  clientName?: string;
  eventDate?: string;
  date?: string;
  location?: string;
}

interface SelectedClient {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface ShowcaseContextValue {
  // Settings
  settings: ShowcaseSettings;
  updateSettings: (updates: Partial<ShowcaseSettings>) => void;
  resetSettings: () => void;

  // Project Context
  selectedProject: SelectedProject | null;
  setSelectedProject: (project: SelectedProject | null) => void;

  // Client Context
  selectedClient: SelectedClient | null;
  setSelectedClient: (client: SelectedClient | null) => void;
  clientMode: boolean;
  setClientMode: (mode: boolean) => void;

  // Showcase Items State
  showcaseItems: unknown[];
  setShowcaseItems: (items: unknown[]) => void;
  refreshShowcase: () => void;

  // Selection & Interaction
  clientSelections: string[];
  toggleSelection: (itemId: string) => void;
  clearSelections: () => void;
  favorites: Set<string>;
  toggleFavorite: (itemId: string) => void;

  // Upload Sync
  lastUploadTimestamp: number | null;
  notifyUploadComplete: (fileInfo: unknown) => void;
}

const defaultSettings: ShowcaseSettings = {
  viewMode: 'grid',
  cardSize: 'medium',
  cardBackground: 'dark',
  cardBorderRadius: 'medium',
  cardShadow: 'medium',
  imageQuality: 'high',
  imageAspectRatio: '16:9',
  clickAction: 'fullscreen',
  doubleClickAction: 'fullscreen',
  hoverEffects: 'scale',
  animationSpeed: 'normal',
  showSelectionButton: true,
  showFavoriteButton: true,
  showCommentButton: true,
  showDownloadButton: true,
  showShareButton: true,
  keyboardShortcuts: true,
  lazyLoading: true,
  viewTracking: true,
  analyticsTracking: true,
  soundEffects: false,
  watermark: 'text',
  watermarkText: 'CreatorHub',
  watermarkPosition: 'bottom-right',
  watermarkSize: 'medium',
  watermarkOpacity: 70,
  audioWatermarkEnabled: false,
  mobileButtonSize: 'medium',
  buttonStyle: 'text',
};

const ShowcaseContext = createContext<ShowcaseContextValue | undefined>(undefined);

export const ShowcaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { communication, dataFlow } = useEnhancedMasterIntegration();

  // State
  const [settings, setSettings] = useState<ShowcaseSettings>(defaultSettings);
  const [selectedProject, setSelectedProjectState] = useState<SelectedProject | null>(null);
  const [selectedClient, setSelectedClientState] = useState<SelectedClient | null>(null);
  const [clientMode, setClientMode] = useState(false);
  const [showcaseItems, setShowcaseItems] = useState<any[]>([]);
  const [clientSelections, setClientSelections] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [lastUploadTimestamp, setLastUploadTimestamp] = useState<number | null>(null);

  // Register with integration system
  useEffect(() => {
    communication.registerComponent('showcase-context', 'context', [
      'data:read', 'data:write','event:emit', 'event:listen',
    ]);

    // Register dataFlow nodes for bi-directional data flow
    dataFlow.registerNode({
      type: 'source',
      componentId: 'showcase-context',
      dataKey: 'showcase-settings',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'showcase-context',
      dataKey: 'showcase-selected-project',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'showcase-context',
      dataKey: 'showcase-selected-client',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'showcase-context',
      dataKey: 'showcase-items',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'showcase-context',
      dataKey: 'showcase-favorites',
    });

    return () => {
      communication.unregisterComponent('showcase-context');
      dataFlow.unregisterNode('showcase-settings');
      dataFlow.unregisterNode('showcase-selected-project');
      dataFlow.unregisterNode('showcase-selected-client');
      dataFlow.unregisterNode('showcase-items');
      dataFlow.unregisterNode('showcase-favorites');
    };
  }, [communication, dataFlow]);

  // Listen for project selection events from UniversalDashboard
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: unknown) => {
      if (message.type === 'project:selected' && message.data) {
        setSelectedProjectState(message.data);
      }
      if (message.type === 'client:selected' && message.data) {
        setSelectedClientState(message.data);
      }
      if (message.type === 'file:uploaded' && message.data) {
        setLastUploadTimestamp(Date.now());
      }
      if (message.type === 'showcase:settings-update' && message.data) {
        setSettings((prev) => ({ ...prev, ...message.data }));
      }
    });

    return unsubscribe;
  }, [communication]);

  // Update settings with persistence
  const updateSettings = useCallback(
    (updates: Partial<ShowcaseSettings>) => {
      setSettings((prev) => {
        const newSettings = { ...prev, ...updates };

        // Persist to server KV and localStorage (fallback)
        apiRequest('/api/user/kv', {
          method: 'POST',
          body: JSON.stringify({ key: 'showcase_settings', value: newSettings }),
        }).catch(() => {});
        localStorage.setItem('showcase-settings', JSON.stringify(newSettings));

        // Broadcast to all components
        communication.sendMessage({
          from: 'showcase-context',
          to: 'all',
          type: 'showcase:settings-update',
          data: updates,
          priority: 'low',
        });

        dataFlow.syncData('showcase:settings', newSettings);

        return newSettings;
      });
    },
    [communication, dataFlow],
  );

  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    apiRequest('/api/user/kv', {
      method: 'POST',
      body: JSON.stringify({ key: 'showcase_settings', value: defaultSettings }),
    }).catch(() => {});
    localStorage.removeItem('showcase-settings');

    communication.sendMessage({
      from: 'showcase-context',
      to: 'all',
      type: 'showcase:settings-reset',
      data: defaultSettings,
      priority: 'low',
    });
  }, [communication]);

  // Set selected project with broadcast
  const setSelectedProject = useCallback(
    (project: SelectedProject | null) => {
      setSelectedProjectState(project);

      if (project) {
        communication.sendMessage({
          from: 'showcase-context',
          to: 'all',
          type: 'showcase:project-selected',
          data: project,
          priority: 'medium',
        });

        dataFlow.syncData('showcase:selectedProject', project);
      }
    },
    [communication, dataFlow],
  );

  // Set selected client with broadcast
  const setSelectedClient = useCallback(
    (client: SelectedClient | null) => {
      setSelectedClientState(client);

      if (client) {
        communication.sendMessage({
          from: 'showcase-context',
          to: 'all',
          type: 'showcase:client-selected',
          data: client,
          priority: 'medium',
        });

        dataFlow.syncData('showcase:selectedClient', client);
      }
    },
    [communication, dataFlow],
  );

  // Toggle selection
  const toggleSelection = useCallback(
    (itemId: string) => {
      setClientSelections((prev) => {
        const newSelections = prev.includes(itemId)
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId];

        // Broadcast selection change
        communication.sendMessage({
          from: 'showcase-context',
          to: 'all',
          type: 'showcase:selection-changed',
          data: { itemId, selected: !prev.includes(itemId), total: newSelections.length },
          priority: 'low',
        });

        return newSelections;
      });
    },
    [communication],
  );

  // Clear all selections
  const clearSelections = useCallback(() => {
    setClientSelections([]);

    communication.sendMessage({
      from: 'showcase-context',
      to: 'all',
      type: 'showcase:selections-cleared',
      data: {},
      priority: 'low',
    });
  }, [communication]);

  // Toggle favorite
  const toggleFavorite = useCallback((itemId: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(itemId)) {
        newFavorites.delete(itemId);
      } else {
        newFavorites.add(itemId);
      }

      // Persist favorites server-first
      const arr = Array.from(newFavorites);
      apiRequest('/api/user/kv', {
        method: 'POST',
        body: JSON.stringify({ key: 'showcase_favorites', value: arr }),
      }).catch(() => {});
      localStorage.setItem('showcase-favorites', JSON.stringify(arr));

      return newFavorites;
    });
  }, []);

  // Refresh showcase items
  const refreshShowcase = useCallback(() => {
    communication.sendMessage({
      from: 'showcase-context',
      to: 'all',
      type: 'showcase:refresh-requested',
      data: { timestamp: Date.now() },
      priority: 'high',
    });
  }, [communication]);

  // Notify upload complete
  const notifyUploadComplete = useCallback(
    (fileInfo: unknown) => {
      setLastUploadTimestamp(Date.now());

      communication.sendMessage({
        from: 'showcase-context',
        to: 'all',
        type: 'showcase:file-uploaded',
        data: fileInfo,
        priority: 'high',
      });

      // Auto-refresh showcase after upload
      setTimeout(() => refreshShowcase(), 1000);
    },
    [communication, refreshShowcase],
  );

  // Load persisted data on mount
  useEffect(() => {
    // Load settings from server first
    apiRequest('/api/user/kv/showcase_settings')
      .then((j: { data?: ShowcaseSettings } | null) => {
        if (j?.data) {
          setSettings(j.data);
        } else {
          const savedSettings = localStorage.getItem('showcase-settings');
          if (savedSettings) {
            try { setSettings(JSON.parse(savedSettings)); } catch {}
          }
        }
      })
      .catch(() => {
        const savedSettings = localStorage.getItem('showcase-settings');
        if (savedSettings) {
          try { setSettings(JSON.parse(savedSettings)); } catch {}
        }
      });

    // Load favorites
    apiRequest('/api/user/kv/showcase_favorites')
      .then((j: { data?: string[] } | null) => {
        if (j?.data) {
          setFavorites(new Set(j.data));
        } else {
          const savedFavorites = localStorage.getItem('showcase-favorites');
          if (savedFavorites) {
            try { setFavorites(new Set(JSON.parse(savedFavorites))); } catch {}
          }
        }
      })
      .catch(() => {
        const savedFavorites = localStorage.getItem('showcase-favorites');
        if (savedFavorites) {
          try { setFavorites(new Set(JSON.parse(savedFavorites))); } catch {}
        }
      });
  }, []);

  const value: ShowcaseContextValue = {
    settings,
    updateSettings,
    resetSettings,
    selectedProject,
    setSelectedProject,
    selectedClient,
    setSelectedClient,
    clientMode,
    setClientMode,
    showcaseItems,
    setShowcaseItems,
    refreshShowcase,
    clientSelections,
    toggleSelection,
    clearSelections,
    favorites,
    toggleFavorite,
    lastUploadTimestamp,
    notifyUploadComplete,
  };

  return <ShowcaseContext.Provider value={value}>{children}</ShowcaseContext.Provider>;
};

export const useShowcase = () => {
  const context = useContext(ShowcaseContext);
  if (context === undefined) {
    throw new Error('useShowcase must be used within a ShowcaseProvider');
  }
  return context;
};
