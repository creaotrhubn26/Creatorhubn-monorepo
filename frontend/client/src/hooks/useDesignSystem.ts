/**
 * useDesignSystem Hook
 * React hook for design system functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  designSystemManager, 
  DesignSystemConfig, 
  DesignSystemState, 
  DesignToken,
  DesignGuideline,
  DesignTheme
} from'../utils/designSystemManager';

export interface UseDesignSystemOptions {
  config?: Partial<DesignSystemConfig>;
  onTokenAdded?: (data: { token: DesignToken }) => void;
  onGuidelineAdded?: (data: { guideline: DesignGuideline }) => void;
  onThemeAdded?: (data: { theme: DesignTheme }) => void;
  onThemeActivated?: (data: { theme: DesignTheme }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UseDesignSystemReturn {
  addToken: (tokenData: Partial<DesignToken>) => Promise<DesignToken>;
  addGuideline: (guidelineData: Partial<DesignGuideline>) => Promise<DesignGuideline>;
  addTheme: (themeData: Partial<DesignTheme>) => Promise<DesignTheme>;
  getToken: (id: string) => DesignToken | null;
  getTokensByType: (type: string) => DesignToken[];
  getTokensByCategory: (category: string) => DesignToken[];
  getGuideline: (id: string) => DesignGuideline | null;
  getGuidelinesByCategory: (category: string) => DesignGuideline[];
  getTheme: (id: string) => DesignTheme | null;
  setActiveTheme: (themeId: string) => void;
  getActiveTheme: () => DesignTheme | null;
  state: DesignSystemState;
  config: DesignSystemConfig;
  updateConfig: (config: Partial<DesignSystemConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  tokens: DesignToken[];
  guidelines: DesignGuideline[];
  themes: DesignTheme[];
  activeTheme: DesignTheme | null;
  totalTokens: number;
  totalGuidelines: number;
  totalThemes: number;
  totalCategories: number;
  totalSubcategories: number;
  totalUsage: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number;
  getAllTokens: () => DesignToken[];
  getAllGuidelines: () => DesignGuideline[];
  getAllThemes: () => DesignTheme[]
}

/**
 * Hook for design system functionality
 */
export const useDesignSystem = (options: UseDesignSystemOptions = {}): UseDesignSystemReturn => {
  const {
    config = {},
    onTokenAdded,
    onGuidelineAdded,
    onThemeAdded,
    onThemeActivated,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<DesignSystemState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    tokens: new Map(),
    guidelines: new Map(),
    themes: new Map(),
    activeTheme: null,
    lastUpdate:  0,
    totalTokens:  0,
    totalGuidelines:  0,
    totalThemes:  0,
    totalCategories:  0,
    totalSubcategories:  0,
    totalUsage:  0,
    totalErrors:  0,
    totalConflicts:  0,
    totalOverrides: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize design system manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      designSystemManager.updateConfig(config);
  }

    // Setup event handlers
    const handleTokenAdded = (data: { token: DesignToken }) => {
      if (onTokenAdded) {
        onTokenAdded(data);
    }
  };

    const handleGuidelineAdded = (data: { guideline: DesignGuideline }) => {
      if (onGuidelineAdded) {
        onGuidelineAdded(data);
    }
  };

    const handleThemeAdded = (data: { theme: DesignTheme }) => {
      if (onThemeAdded) {
        onThemeAdded(data);
    }
  };

    const handleThemeActivated = (data: { theme: DesignTheme }) => {
      if (onThemeActivated) {
        onThemeActivated(data);
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
    eventHandlersRef.current.set('token_added', handleTokenAdded);
    eventHandlersRef.current.set('guideline_added', handleGuidelineAdded);
    eventHandlersRef.current.set('theme_added', handleThemeAdded);
    eventHandlersRef.current.set('theme_activated', handleThemeActivated);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    designSystemManager.on('token_added', handleTokenAdded);
    designSystemManager.on('guideline_added', handleGuidelineAdded);
    designSystemManager.on('theme_added', handleThemeAdded);
    designSystemManager.on('theme_activated', handleThemeActivated);
    designSystemManager.on('error', handleError);
    designSystemManager.on('initialized', handleInitialized);

    // Update initial state
    setState(designSystemManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        designSystemManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onTokenAdded, onGuidelineAdded, onThemeAdded, onThemeActivated, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = designSystemManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Add token
  const addToken = useCallback(async (tokenData: Partial<DesignToken>) => {
    return await designSystemManager.addToken(tokenData);
}, []);

  // Add guideline
  const addGuideline = useCallback(async (guidelineData: Partial<DesignGuideline>) => {
    return await designSystemManager.addGuideline(guidelineData);
}, []);

  // Add theme
  const addTheme = useCallback(async (themeData: Partial<DesignTheme>) => {
    return await designSystemManager.addTheme(themeData);
}, []);

  // Get token by ID
  const getToken = useCallback((id: string) => {
    return designSystemManager.getToken(id);
}, []);

  // Get tokens by type
  const getTokensByType = useCallback((type: string) => {
    return designSystemManager.getTokensByType(type);
}, []);

  // Get tokens by category
  const getTokensByCategory = useCallback((category: string) => {
    return designSystemManager.getTokensByCategory(category);
}, []);

  // Get guideline by ID
  const getGuideline = useCallback((id: string) => {
    return designSystemManager.getGuideline(id);
}, []);

  // Get guidelines by category
  const getGuidelinesByCategory = useCallback((category: string) => {
    return designSystemManager.getGuidelinesByCategory(category);
}, []);

  // Get theme by ID
  const getTheme = useCallback((id: string) => {
    return designSystemManager.getTheme(id);
}, []);

  // Set active theme
  const setActiveTheme = useCallback((themeId: string) => {
    designSystemManager.setActiveTheme(themeId);
}, []);

  // Get active theme
  const getActiveTheme = useCallback(() => {
    return designSystemManager.getActiveTheme();
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<DesignSystemConfig>) => {
    designSystemManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return designSystemManager.getConfig();
}, []);

  // Get all tokens
  const getAllTokens = useCallback(() => {
    return designSystemManager.getAllTokens();
}, []);

  // Get all guidelines
  const getAllGuidelines = useCallback(() => {
    return designSystemManager.getAllGuidelines();
}, []);

  // Get all themes
  const getAllThemes = useCallback(() => {
    return designSystemManager.getAllThemes();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    addToken,
    addGuideline,
    addTheme,
    getToken,
    getTokensByType,
    getTokensByCategory,
    getGuideline,
    getGuidelinesByCategory,
    getTheme,
    setActiveTheme,
    getActiveTheme,
    state,
    currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    tokens: Array.from(state.tokens.values()),
    guidelines: Array.from(state.guidelines.values()),
    themes: Array.from(state.themes.values()),
    activeTheme: state.activeTheme ? state.themes.get(state.activeTheme) || null : null,
    totalTokens: state.totalTokens,
    totalGuidelines: state.totalGuidelines,
    totalThemes: state.totalThemes,
    totalCategories: state.totalCategories,
    totalSubcategories: state.totalSubcategories,
    totalUsage: state.totalUsage,
    totalErrors: state.totalErrors,
    totalConflicts: state.totalConflicts,
    totalOverrides: state.totalOverrides,
    getAllTokens,
    getAllGuidelines,
    getAllThemes
}), [
    addToken,
    addGuideline,
    addTheme,
    getToken,
    getTokensByType,
    getTokensByCategory,
    getGuideline,
    getGuidelinesByCategory,
    getTheme,
    setActiveTheme,
    getActiveTheme,
    state,
    currentConfig,
    updateConfig,
    getAllTokens,
    getAllGuidelines,
    getAllThemes
  ]);

  return returnValue;
};

export default useDesignSystem;



