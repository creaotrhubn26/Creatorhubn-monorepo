/**
 * useKeyboardShortcuts Hook
 * React hook for keyboard shortcuts functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { 
  KeyboardConfig, 
  KeyboardState, 
  KeyboardShortcut,
  KeyboardContext
} from '../utils/keyboardShortcutsManager';
import { 
  keyboardShortcutsManager
} from'../utils/keyboardShortcutsManager';

export interface UseKeyboardShortcutsOptions {
  config?: Partial<KeyboardConfig>;
  onShortcutCreated?: (data: { shortcut: KeyboardShortcut }) => void;
  onShortcutExecuted?: (data: { shortcut: KeyboardShortcut; event?: KeyboardEvent }) => void;
  onShortcutExecutionFailed?: (data: { shortcut: KeyboardShortcut; event?: KeyboardEvent; error: string }) => void;
  onContextChanged?: (data: { contexts: string[] }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void;
}

export interface UseKeyboardShortcutsReturn {
  createShortcut: (shortcutData: Partial<KeyboardShortcut>) => Promise<KeyboardShortcut>;
  executeShortcut: (shortcutId: string, event?: KeyboardEvent) => Promise<void>;
  state: KeyboardState;
  config: KeyboardConfig;
  updateConfig: (config: Partial<KeyboardConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  shortcuts: KeyboardShortcut[];
  contexts: KeyboardContext[];
  activeContexts: string[];
  recording: boolean;
  playback: boolean;
  totalShortcuts: number;
  totalContexts: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  averageMemoryUsage: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number;
  getShortcuts: () => KeyboardShortcut[];
  getContexts: () => KeyboardContext[]
}

/**
 * Hook for keyboard shortcuts functionality
 */
export const useKeyboardShortcuts = (options: UseKeyboardShortcutsOptions = {}): UseKeyboardShortcutsReturn => {
  const {
    config: optionConfig = {},
    onShortcutCreated,
    onShortcutExecuted,
    onShortcutExecutionFailed,
    onContextChanged,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<KeyboardState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    shortcuts: new Map(),
    contexts: new Map(),
    activeContexts:  [],
    recording: false,
    playback: false,
    lastUpdate:  0,
    totalShortcuts:  0,
    totalContexts:  0,
    totalExecutions:  0,
    successfulExecutions:  0,
    failedExecutions:  0,
    averageExecutionTime:  0,
    averageMemoryUsage:  0,
    totalErrors:  0,
    totalConflicts:  0,
    totalOverrides: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize keyboard shortcuts manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(optionConfig).length > 0) {
      keyboardShortcutsManager.updateConfig(optionConfig);
  }

    // Setup event handlers
    const handleShortcutCreated = (data: { shortcut: KeyboardShortcut }) => {
      if (onShortcutCreated) {
        onShortcutCreated(data);
    }
  };

    const handleShortcutExecuted = (data: { shortcut: KeyboardShortcut; event?: KeyboardEvent }) => {
      if (onShortcutExecuted) {
        onShortcutExecuted(data);
    }
  };

    const handleShortcutExecutionFailed = (data: { shortcut: KeyboardShortcut; event?: KeyboardEvent; error: string }) => {
      if (onShortcutExecutionFailed) {
        onShortcutExecutionFailed(data);
    }
  };

    const handleContextChanged = (data: { contexts: string[] }) => {
      if (onContextChanged) {
        onContextChanged(data);
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
    eventHandlersRef.current.set('shortcut_created', handleShortcutCreated);
    eventHandlersRef.current.set('shortcut_executed', handleShortcutExecuted);
    eventHandlersRef.current.set('shortcut_execution_failed', handleShortcutExecutionFailed);
    eventHandlersRef.current.set('context_changed', handleContextChanged);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    keyboardShortcutsManager.on('shortcut_created', handleShortcutCreated);
    keyboardShortcutsManager.on('shortcut_executed', handleShortcutExecuted);
    keyboardShortcutsManager.on('shortcut_execution_failed', handleShortcutExecutionFailed);
    keyboardShortcutsManager.on('context_changed', handleContextChanged);
    keyboardShortcutsManager.on('error', handleError);
    keyboardShortcutsManager.on('initialized', handleInitialized);

    // Update initial state
    setState(keyboardShortcutsManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        keyboardShortcutsManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [optionConfig, onShortcutCreated, onShortcutExecuted, onShortcutExecutionFailed, onContextChanged, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = keyboardShortcutsManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Create shortcut
  const createShortcut = useCallback(async (shortcutData: Partial<KeyboardShortcut>) => {
    return await keyboardShortcutsManager.createShortcut(shortcutData);
}, []);

  // Execute shortcut
  const executeShortcut = useCallback(async (shortcutId: string, event?: KeyboardEvent) => {
    await keyboardShortcutsManager.executeShortcut(shortcutId, event);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<KeyboardConfig>) => {
    keyboardShortcutsManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return keyboardShortcutsManager.getConfig();
}, []);

  // Get shortcuts
  const getShortcuts = useCallback(() => {
    return keyboardShortcutsManager.getShortcuts();
}, []);

  // Get contexts
  const getContexts = useCallback(() => {
    return keyboardShortcutsManager.getContexts();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    createShortcut,
    executeShortcut,
    state,
    config: currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    shortcuts: Array.from(state.shortcuts.values()),
    contexts: Array.from(state.contexts.values()),
    activeContexts: state.activeContexts,
    recording: state.recording,
    playback: state.playback,
    totalShortcuts: state.totalShortcuts,
    totalContexts: state.totalContexts,
    totalExecutions: state.totalExecutions,
    successfulExecutions: state.successfulExecutions,
    failedExecutions: state.failedExecutions,
    averageExecutionTime: state.averageExecutionTime,
    averageMemoryUsage: state.averageMemoryUsage,
    totalErrors: state.totalErrors,
    totalConflicts: state.totalConflicts,
    totalOverrides: state.totalOverrides,
    getShortcuts,
    getContexts
}), [
    createShortcut,
    executeShortcut,
    state,
    currentConfig,
    updateConfig,
    getShortcuts,
    getContexts
  ]);

  return returnValue;
};

export default useKeyboardShortcuts;




