/**
 * usePlugins Hook
 * React hook for plugin system functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { 
  PluginConfig, 
  PluginState, 
  Plugin,
  PluginHook,
  PluginComponent,
  PluginUtility,
  PluginTheme,
  PluginIntegration
} from '../utils/pluginManager';
import { 
  pluginManager
} from'../utils/pluginManager';

export interface UsePluginsOptions {
  config?: Partial<PluginConfig>;
  onPluginInstalled?: (data: { plugin: Plugin }) => void;
  onPluginRemoved?: (data: { plugin: Plugin }) => void;
  onPluginLoaded?: (data: { plugin: Plugin }) => void;
  onPluginUnloaded?: (data: { plugin: Plugin }) => void;
  onPluginEnabled?: (data: { plugin: Plugin }) => void;
  onPluginDisabled?: (data: { plugin: Plugin }) => void;
  onPluginInstallFailed?: (data: { plugin: Plugin; error: string }) => void;
  onPluginRemoveFailed?: (data: { plugin: Plugin; error: string }) => void;
  onPluginLoadFailed?: (data: { plugin: Plugin; error: string }) => void;
  onPluginUnloadFailed?: (data: { plugin: Plugin; error: string }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UsePluginsReturn {
  installPlugin: (pluginData: Partial<Plugin>) => Promise<Plugin>;
  removePlugin: (pluginId: string) => Promise<void>;
  loadPlugin: (pluginId: string) => Promise<void>;
  unloadPlugin: (pluginId: string) => Promise<void>;
  enablePlugin: (pluginId: string) => Promise<void>;
  disablePlugin: (pluginId: string) => Promise<void>;
  state: PluginState;
  config: PluginConfig;
  updateConfig: (config: Partial<PluginConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  plugins: Plugin[];
  activePlugins: Plugin[];
  hooks: PluginHook[];
  components: PluginComponent[];
  utilities: PluginUtility[];
  themes: PluginTheme[];
  integrations: PluginIntegration[];
  totalPlugins: number;
  activePluginsCount: number;
  loadingPluginsCount: number;
  errorPluginsCount: number;
  disabledPluginsCount: number;
  totalHooks: number;
  totalComponents: number;
  totalUtilities: number;
  totalThemes: number;
  totalIntegrations: number;
  averageLoadTime: number;
  averageRenderTime: number;
  averageExecutionTime: number;
  averageMemoryUsage: number;
  averageCpuUsage: number;
  totalErrors: number;
  totalUsage: number
}

/**
 * Hook for plugin functionality
 */
export const usePlugins = (options: UsePluginsOptions = {}): UsePluginsReturn => {
  const {
    config = {},
    onPluginInstalled,
    onPluginRemoved,
    onPluginLoaded,
    onPluginUnloaded,
    onPluginEnabled,
    onPluginDisabled,
    onPluginInstallFailed,
    onPluginRemoveFailed,
    onPluginLoadFailed,
    onPluginUnloadFailed,
    onError,
    onInitialized
  } = options;

  const [state, setState] = useState<PluginState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    plugins: new Map(),
    hooks: new Map(),
    components: new Map(),
    utilities: new Map(),
    themes: new Map(),
    integrations: new Map(),
    activePlugins:  [],
    loadingPlugins:  [],
    errorPlugins:  [],
    disabledPlugins:  [],
    lastUpdate:  0,
    totalPlugins:  0,
    activePluginsCount:  0,
    loadingPluginsCount:  0,
    errorPluginsCount:  0,
    disabledPluginsCount:  0,
    totalHooks:  0,
    totalComponents:  0,
    totalUtilities:  0,
    totalThemes:  0,
    totalIntegrations:  0,
    averageLoadTime:  0,
    averageRenderTime:  0,
    averageExecutionTime:  0,
    averageMemoryUsage:  0,
    averageCpuUsage:  0,
    totalErrors:  0,
    totalUsage: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize plugin manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      pluginManager.updateConfig(config);
  }

    // Setup event handlers
    const handlePluginInstalled = (data: { plugin: Plugin }) => {
      if (onPluginInstalled) {
        onPluginInstalled(data);
    }
  };

    const handlePluginRemoved = (data: { plugin: Plugin }) => {
      if (onPluginRemoved) {
        onPluginRemoved(data);
    }
  };

    const handlePluginLoaded = (data: { plugin: Plugin }) => {
      if (onPluginLoaded) {
        onPluginLoaded(data);
    }
  };

    const handlePluginUnloaded = (data: { plugin: Plugin }) => {
      if (onPluginUnloaded) {
        onPluginUnloaded(data);
    }
  };

    const handlePluginEnabled = (data: { plugin: Plugin }) => {
      if (onPluginEnabled) {
        onPluginEnabled(data);
    }
  };

    const handlePluginDisabled = (data: { plugin: Plugin }) => {
      if (onPluginDisabled) {
        onPluginDisabled(data);
    }
  };

    const handlePluginInstallFailed = (data: { plugin: Plugin; error: string }) => {
      if (onPluginInstallFailed) {
        onPluginInstallFailed(data);
    }
  };

    const handlePluginRemoveFailed = (data: { plugin: Plugin; error: string }) => {
      if (onPluginRemoveFailed) {
        onPluginRemoveFailed(data);
    }
  };

    const handlePluginLoadFailed = (data: { plugin: Plugin; error: string }) => {
      if (onPluginLoadFailed) {
        onPluginLoadFailed(data);
    }
  };

    const handlePluginUnloadFailed = (data: { plugin: Plugin; error: string }) => {
      if (onPluginUnloadFailed) {
        onPluginUnloadFailed(data);
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
    eventHandlersRef.current.set('plugin_installed', handlePluginInstalled);
    eventHandlersRef.current.set('plugin_removed', handlePluginRemoved);
    eventHandlersRef.current.set('plugin_loaded', handlePluginLoaded);
    eventHandlersRef.current.set('plugin_unloaded', handlePluginUnloaded);
    eventHandlersRef.current.set('plugin_enabled', handlePluginEnabled);
    eventHandlersRef.current.set('plugin_disabled', handlePluginDisabled);
    eventHandlersRef.current.set('plugin_install_failed', handlePluginInstallFailed);
    eventHandlersRef.current.set('plugin_remove_failed', handlePluginRemoveFailed);
    eventHandlersRef.current.set('plugin_load_failed', handlePluginLoadFailed);
    eventHandlersRef.current.set('plugin_unload_failed', handlePluginUnloadFailed);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    pluginManager.on('plugin_installed', handlePluginInstalled);
    pluginManager.on('plugin_removed', handlePluginRemoved);
    pluginManager.on('plugin_loaded', handlePluginLoaded);
    pluginManager.on('plugin_unloaded', handlePluginUnloaded);
    pluginManager.on('plugin_enabled', handlePluginEnabled);
    pluginManager.on('plugin_disabled', handlePluginDisabled);
    pluginManager.on('plugin_install_failed', handlePluginInstallFailed);
    pluginManager.on('plugin_remove_failed', handlePluginRemoveFailed);
    pluginManager.on('plugin_load_failed', handlePluginLoadFailed);
    pluginManager.on('plugin_unload_failed', handlePluginUnloadFailed);
    pluginManager.on('error', handleError);
    pluginManager.on('initialized', handleInitialized);

    // Update initial state
    setState(pluginManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        pluginManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onPluginInstalled, onPluginRemoved, onPluginLoaded, onPluginUnloaded, onPluginEnabled, onPluginDisabled, onPluginInstallFailed, onPluginRemoveFailed, onPluginLoadFailed, onPluginUnloadFailed, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = pluginManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Install plugin
  const installPlugin = useCallback(async (pluginData: Partial<Plugin>) => {
    return await pluginManager.installPlugin(pluginData);
}, []);

  // Remove plugin
  const removePlugin = useCallback(async (pluginId: string) => {
    await pluginManager.removePlugin(pluginId);
}, []);

  // Load plugin
  const loadPlugin = useCallback(async (pluginId: string) => {
    await pluginManager.loadPlugin(pluginId);
}, []);

  // Unload plugin
  const unloadPlugin = useCallback(async (pluginId: string) => {
    await pluginManager.unloadPlugin(pluginId);
}, []);

  // Enable plugin
  const enablePlugin = useCallback(async (pluginId: string) => {
    await pluginManager.enablePlugin(pluginId);
}, []);

  // Disable plugin
  const disablePlugin = useCallback(async (pluginId: string) => {
    await pluginManager.disablePlugin(pluginId);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<PluginConfig>) => {
    pluginManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return pluginManager.getConfig();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    installPlugin,
    removePlugin,
    loadPlugin,
    unloadPlugin,
    enablePlugin,
    disablePlugin,
    state,
    config: currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    plugins: Array.from(state.plugins.values()),
    activePlugins: state.activePlugins.map(id => state.plugins.get(id)).filter(Boolean) as Plugin[],
    hooks: Array.from(state.hooks.values()),
    components: Array.from(state.components.values()),
    utilities: Array.from(state.utilities.values()),
    themes: Array.from(state.themes.values()),
    integrations: Array.from(state.integrations.values()),
    totalPlugins: state.totalPlugins,
    activePluginsCount: state.activePluginsCount,
    loadingPluginsCount: state.loadingPluginsCount,
    errorPluginsCount: state.errorPluginsCount,
    disabledPluginsCount: state.disabledPluginsCount,
    totalHooks: state.totalHooks,
    totalComponents: state.totalComponents,
    totalUtilities: state.totalUtilities,
    totalThemes: state.totalThemes,
    totalIntegrations: state.totalIntegrations,
    averageLoadTime: state.averageLoadTime,
    averageRenderTime: state.averageRenderTime,
    averageExecutionTime: state.averageExecutionTime,
    averageMemoryUsage: state.averageMemoryUsage,
    averageCpuUsage: state.averageCpuUsage,
    totalErrors: state.totalErrors,
    totalUsage: state.totalUsage
}), [
    installPlugin,
    removePlugin,
    loadPlugin,
    unloadPlugin,
    enablePlugin,
    disablePlugin,
    state,
    currentConfig,
    updateConfig
  ]);

  return returnValue;
};

export default usePlugins;



