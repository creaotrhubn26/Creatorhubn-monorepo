/**
 * useTheme Hook
 * React hook for theme management functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { 
  ThemeConfig, 
  ThemeState, 
  Theme 
} from '../utils/themeManager';
import { 
  themeManager 
} from '../utils/themeManager';

export interface UseThemeOptions {
  config?: Partial<ThemeConfig>;
  onThemeChanged?: (data: { theme: Theme; previousTheme: string }) => void;
  onThemeChangeFailed?: (data: { theme: Theme; error: string }) => void;
  onSystemThemeChanged?: (data: { theme: string }) => void;
  onCustomThemeCreated?: (data: { theme: Theme }) => void;
  onCustomThemeCreateFailed?: (data: { theme: Theme; error: string }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void}

export interface UseThemeReturn {
  switchTheme: (themeId: string) => Promise<void>;
  toggleDarkMode: () => Promise<void>;
  setSystemTheme: () => Promise<void>;
  createCustomTheme: (themeData: Partial<Theme>) => Promise<Theme>;
  state: ThemeState;
  config: ThemeConfig;
  updateConfig: (config: Partial<ThemeConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  currentTheme: string;
  systemTheme: 'light' | 'dark' | 'auto';
  isDarkMode: boolean;
  isSystemTheme: boolean;
  themes: Theme[];
  customThemes: Theme[];
  totalThemes: number;
  totalCustomThemes: number;
  themeChanges: number;
  systemThemeChanges: number;
  darkModeChanges: number;
  getCurrentTheme: () => Theme | null;
  getThemes: () => Theme[];
  getCustomThemes: () => Theme[]}

/**
 * Hook for theme management functionality
 */
export const useTheme = (options: UseThemeOptions = {}): UseThemeReturn => {
  const {
    config: optionConfig = {},
    onThemeChanged,
    onThemeChangeFailed,
    onSystemThemeChanged,
    onCustomThemeCreated,
    onCustomThemeCreateFailed,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<ThemeState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    currentTheme: 'light',
    systemTheme: 'auto',
    isDarkMode: false,
    isSystemTheme: false,
    themes: new Map(),
    customThemes: new Map(),
    lastUpdate: 0,
    totalThemes: 0,
    totalCustomThemes: 0,
    themeChanges: 0,
    systemThemeChanges: 0,
    darkModeChanges: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize theme manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(optionConfig).length > 0) {
      themeManager.updateConfig(optionConfig);
  }

    // Setup event handlers
    const handleThemeChanged = (data: { theme: Theme; previousTheme: string }) => {
      if (onThemeChanged) {
        onThemeChanged(data);
    }
  };

    const handleThemeChangeFailed = (data: { theme: Theme; error: string }) => {
      if (onThemeChangeFailed) {
        onThemeChangeFailed(data);
    }
  };

    const handleSystemThemeChanged = (data: { theme: string }) => {
      if (onSystemThemeChanged) {
        onSystemThemeChanged(data);
    }
  };

    const handleCustomThemeCreated = (data: { theme: Theme }) => {
      if (onCustomThemeCreated) {
        onCustomThemeCreated(data);
    }
  };

    const handleCustomThemeCreateFailed = (data: { theme: Theme; error: string }) => {
      if (onCustomThemeCreateFailed) {
        onCustomThemeCreateFailed(data);
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
    eventHandlersRef.current.set('theme_changed', handleThemeChanged);
    eventHandlersRef.current.set('theme_change_failed', handleThemeChangeFailed);
    eventHandlersRef.current.set('system_theme_changed', handleSystemThemeChanged);
    eventHandlersRef.current.set('custom_theme_created', handleCustomThemeCreated);
    eventHandlersRef.current.set('custom_theme_create_failed', handleCustomThemeCreateFailed);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    themeManager.on('theme_changed', handleThemeChanged);
    themeManager.on('theme_change_failed', handleThemeChangeFailed);
    themeManager.on('system_theme_changed', handleSystemThemeChanged);
    themeManager.on('custom_theme_created', handleCustomThemeCreated);
    themeManager.on('custom_theme_create_failed', handleCustomThemeCreateFailed);
    themeManager.on('error', handleError);
    themeManager.on('initialized', handleInitialized);

    // Update initial state
    setState(themeManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        themeManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [optionConfig, onThemeChanged, onThemeChangeFailed, onSystemThemeChanged, onCustomThemeCreated, onCustomThemeCreateFailed, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = themeManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Switch theme
  const switchTheme = useCallback(async (themeId: string) => {
    await themeManager.switchTheme(themeId);
}, []);

  // Toggle dark mode
  const toggleDarkMode = useCallback(async () => {
    await themeManager.toggleDarkMode();
}, []);

  // Set system theme
  const setSystemTheme = useCallback(async () => {
    await themeManager.setSystemTheme();
}, []);

  // Create custom theme
  const createCustomTheme = useCallback(async (themeData: Partial<Theme>) => {
    return await themeManager.createCustomTheme(themeData);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<ThemeConfig>) => {
    themeManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return themeManager.getConfig();
}, []);

  // Get current theme
  const getCurrentTheme = useCallback(() => {
    return themeManager.getCurrentTheme();
}, []);

  // Get themes
  const getThemes = useCallback(() => {
    return themeManager.getThemes();
}, []);

  // Get custom themes
  const getCustomThemes = useCallback(() => {
    return themeManager.getCustomThemes();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    switchTheme,
    toggleDarkMode,
    setSystemTheme,
    createCustomTheme,
    state,
    config: currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    currentTheme: state.currentTheme,
    systemTheme: state.systemTheme,
    isDarkMode: state.isDarkMode,
    isSystemTheme: state.isSystemTheme,
    themes: Array.from(state.themes.values()),
    customThemes: Array.from(state.customThemes.values()),
    totalThemes: state.totalThemes,
    totalCustomThemes: state.totalCustomThemes,
    themeChanges: state.themeChanges,
    systemThemeChanges: state.systemThemeChanges,
    darkModeChanges: state.darkModeChanges,
    getCurrentTheme,
    getThemes,
    getCustomThemes
}), [
    switchTheme,
    toggleDarkMode,
    setSystemTheme,
    createCustomTheme,
    state,
    currentConfig,
    updateConfig,
    getCurrentTheme,
    getThemes,
    getCustomThemes
  ]);

  return returnValue;
};

export default useTheme;




