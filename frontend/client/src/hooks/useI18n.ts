/**
 * useI18n Hook
 * React hook for internationalization and localization
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { 
  I18nConfig, 
  I18nState, 
  TranslationOptions 
} from '../utils/i18nManager';
import { 
  i18nManager 
} from '../utils/i18nManager';

export interface UseI18nOptions {
  config?: Partial<I18nConfig>;
  onLanguageChanged?: (language: string) => void;
  onLanguageLoaded?: (language: string, namespace: string) => void;
  onError?: (error: string) => void;
  onReady?: () => void}

export interface UseI18nReturn {
  t: (key: string, options?: TranslationOptions) => string;
  changeLanguage: (language: string) => Promise<void>;
  getCurrentLanguage: () => string;
  getSupportedLanguages: () => string[];
  isLanguageLoaded: (language: string, namespace?: string) => boolean;
  getLoadedLanguages: () => string[];
  getLoadedNamespaces: () => string[];
  isRTL: (language?: string) => boolean;
  state: I18nState;
  config: I18nConfig;
  updateConfig: (config: Partial<I18nConfig>) => void;
  clearAllData: () => void;
  isLoading: boolean;
  isReady: boolean;
  hasError: boolean;
  error: string | null;
  currentLanguage: string;
  supportedLanguages: string[];
  loadedLanguages: string[];
  loadedNamespaces: string[]}

/**
 * Hook for i18n functionality
 */
export const useI18n = (options: UseI18nOptions = {}): UseI18nReturn => {
  const {
    config: initialConfig = {},
    onLanguageChanged,
    onLanguageLoaded,
    onError,
    onReady
} = options;

  const [state, setState] = useState<I18nState>({
    currentLanguage: 'en',
    isLoading: false,
    isReady: false,
    hasError: false,
    error: null,
    loadedLanguages: [],
    loadedNamespaces: [],
    translations: new Map(),
    fallbackTranslations: new Map()
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize i18n manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(initialConfig).length > 0) {
      i18nManager.updateConfig(initialConfig);
  }

    // Setup event handlers
    const handleLanguageChanged = (data: { language: string,}) => {
      if (onLanguageChanged) {
        onLanguageChanged(data.language);
    }
  };

    const handleLanguageLoaded = (data: { language: string; namespace: string,}) => {
      if (onLanguageLoaded) {
        onLanguageLoaded(data.language, data.namespace);
    }
  };

    const handleError = (data: { error: string,}) => {
      if (onError) {
        onError(data.error);
    }
  };

    const handleReady = () => {
      if (onReady) {
        onReady();
    }
  };

    // Store event handlers
    eventHandlersRef.current.set('language_changed', handleLanguageChanged);
    eventHandlersRef.current.set('language_loaded', handleLanguageLoaded);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('ready', handleReady);

    // Add event listeners
    i18nManager.on('language_changed', handleLanguageChanged);
    i18nManager.on('language_loaded', handleLanguageLoaded);
    i18nManager.on('error', handleError);
    i18nManager.on('ready', handleReady);

    // Update initial state
    setState(i18nManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        i18nManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [initialConfig, onLanguageChanged, onLanguageLoaded, onError, onReady]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = i18nManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Translate function
  const t = useCallback((key: string, options: TranslationOptions = {}) => {
    return i18nManager.translate(key, options);
}, []);

  // Change language
  const changeLanguage = useCallback(async (language: string) => {
    await i18nManager.changeLanguage(language);
}, []);

  // Get current language
  const getCurrentLanguage = useCallback(() => {
    return i18nManager.getCurrentLanguage();
}, []);

  // Get supported languages
  const getSupportedLanguages = useCallback(() => {
    return i18nManager.getSupportedLanguages();
}, []);

  // Check if language is loaded
  const isLanguageLoaded = useCallback((language: string, namespace?: string) => {
    return i18nManager.isLanguageLoaded(language, namespace);
}, []);

  // Get loaded languages
  const getLoadedLanguages = useCallback(() => {
    return i18nManager.getLoadedLanguages();
}, []);

  // Get loaded namespaces
  const getLoadedNamespaces = useCallback(() => {
    return i18nManager.getLoadedNamespaces();
}, []);

  // Check if RTL
  const isRTL = useCallback((language?: string) => {
    return i18nManager.isRTL(language);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<I18nConfig>) => {
    i18nManager.updateConfig(newConfig);
}, []);

  // Clear all data
  const clearAllData = useCallback(() => {
    i18nManager.clearAllData();
}, []);

  // Get configuration
  const config = useMemo(() => {
    return i18nManager.getConfig();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    t,
    changeLanguage,
    getCurrentLanguage,
    getSupportedLanguages,
    isLanguageLoaded,
    getLoadedLanguages,
    getLoadedNamespaces,
    isRTL,
    state,
    config,
    updateConfig,
    clearAllData,
    isLoading: state.isLoading,
    isReady: state.isReady,
    hasError: state.hasError,
    error: state.error,
    currentLanguage: state.currentLanguage,
    supportedLanguages: i18nManager.getSupportedLanguages(),
    loadedLanguages: state.loadedLanguages,
    loadedNamespaces: state.loadedNamespaces
}), [
    t,
    changeLanguage,
    getCurrentLanguage,
    getSupportedLanguages,
    isLanguageLoaded,
    getLoadedLanguages,
    getLoadedNamespaces,
    isRTL,
    state,
    config,
    updateConfig,
    clearAllData
  ]);

  return returnValue;
};

export default useI18n;





