/**
 * useTemplate Hook
 * React hook for template management functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  templateManager,
  type TemplateConfig,
  type TemplateManagerState,
  type Template,
  type TemplateCategory,
  type TemplateSearchQuery,
} from '../utils/templateManager';

const EMPTY_TEMPLATE_CONFIG: Partial<TemplateConfig> = {};

export interface UseTemplateOptions {
  config?: Partial<TemplateConfig>;
  onTemplateAdded?: (data: { template: Template }) => void;
  onCategoryAdded?: (data: { category: TemplateCategory }) => void;
  onSearchCompleted?: (data: { query: TemplateSearchQuery; results: Template[] }) => void;
  onSearchFailed?: (data: { query: TemplateSearchQuery; error: string }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UseTemplateReturn {
  addTemplate: (templateData: Partial<Template>) => Promise<Template>;
  addCategory: (categoryData: Partial<TemplateCategory>) => Promise<TemplateCategory>;
  searchTemplates: (query: TemplateSearchQuery) => Promise<Template[]>;
  getTemplate: (id: string) => Template | null;
  getTemplatesByType: (type: string) => Template[];
  getTemplatesByCategory: (category: string) => Template[];
  getCategory: (id: string) => TemplateCategory | null;
  state: TemplateManagerState;
  config: TemplateConfig;
  updateConfig: (config: Partial<TemplateConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  templates: Template[];
  categories: TemplateCategory[];
  searchResults: Template[];
  lastSearchQuery: TemplateSearchQuery | null;
  totalTemplates: number;
  totalCategories: number;
  totalUsage: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number;
  getAllTemplates: () => Template[];
  getAllCategories: () => TemplateCategory[]
}

/**
 * Hook for template management functionality
 */
export const useTemplate = (options: UseTemplateOptions = {}): UseTemplateReturn => {
  const {
    config: incomingConfig,
    onTemplateAdded,
    onCategoryAdded,
    onSearchCompleted,
    onSearchFailed,
    onError,
    onInitialized
  } = options;
  const config = incomingConfig ?? EMPTY_TEMPLATE_CONFIG;

  const [state, setState] = useState<TemplateManagerState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    templates: new Map(),
    categories: new Map(),
    searchResults:  [],
    lastSearchQuery: null,
    lastUpdate:  0,
    totalTemplates:  0,
    totalCategories:  0,
    totalUsage:  0,
    totalErrors:  0,
    totalConflicts:  0,
    totalOverrides: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize template manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      templateManager.updateConfig(config);
  }

    // Setup event handlers
    const handleTemplateAdded = (data: { template: Template }) => {
      if (onTemplateAdded) {
        onTemplateAdded(data);
    }
  };

    const handleCategoryAdded = (data: { category: TemplateCategory }) => {
      if (onCategoryAdded) {
        onCategoryAdded(data);
    }
  };

  const handleSearchCompleted = (data: { query: TemplateSearchQuery; results: Template[] }) => {
    if (onSearchCompleted) {
      onSearchCompleted(data);
    }
  };

  const handleSearchFailed = (data: { query: TemplateSearchQuery; error: string }) => {
    if (onSearchFailed) {
      onSearchFailed(data);
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

    // Add event listeners
    templateManager.on('template_added', handleTemplateAdded);
    templateManager.on('category_added', handleCategoryAdded);
    templateManager.on('search_completed', handleSearchCompleted);
    templateManager.on('search_failed', handleSearchFailed);
    templateManager.on('error', handleError);
    templateManager.on('initialized', handleInitialized);

    // Update initial state
    setState(templateManager.getState());

    return () => {
      templateManager.off('template_added', handleTemplateAdded);
      templateManager.off('category_added', handleCategoryAdded);
      templateManager.off('search_completed', handleSearchCompleted);
      templateManager.off('search_failed', handleSearchFailed);
      templateManager.off('error', handleError);
      templateManager.off('initialized', handleInitialized);
  };
}, [config, onTemplateAdded, onCategoryAdded, onSearchCompleted, onSearchFailed, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = templateManager.getState();
      setState((previousState) => {
        if (
          previousState.isEnabled === currentState.isEnabled
          && previousState.isInitialized === currentState.isInitialized
          && previousState.hasError === currentState.hasError
          && previousState.error === currentState.error
          && previousState.lastUpdate === currentState.lastUpdate
          && previousState.totalTemplates === currentState.totalTemplates
          && previousState.totalCategories === currentState.totalCategories
          && previousState.totalUsage === currentState.totalUsage
          && previousState.totalErrors === currentState.totalErrors
          && previousState.totalConflicts === currentState.totalConflicts
          && previousState.totalOverrides === currentState.totalOverrides
          && previousState.searchResults === currentState.searchResults
          && previousState.lastSearchQuery === currentState.lastSearchQuery
          && previousState.templates === currentState.templates
          && previousState.categories === currentState.categories
        ) {
          return previousState;
        }

        return currentState;
      });
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Add template
  const addTemplate = useCallback(async (templateData: Partial<Template>) => {
    return await templateManager.addTemplate(templateData);
}, []);

  // Add category
  const addCategory = useCallback(async (categoryData: Partial<TemplateCategory>) => {
    return await templateManager.addCategory(categoryData);
}, []);

  // Search templates
  const searchTemplates = useCallback(async (query: TemplateSearchQuery) => {
    return await templateManager.searchTemplates(query);
}, []);

  // Get template by ID
  const getTemplate = useCallback((id: string) => {
    return templateManager.getTemplate(id) || null;
}, []);

  // Get templates by type
  const getTemplatesByType = useCallback((type: string) => {
    return templateManager.getTemplatesByType(type);
}, []);

  // Get templates by category
  const getTemplatesByCategory = useCallback((category: string) => {
    return templateManager.getTemplatesByCategory(category);
}, []);

  // Get category by ID
  const getCategory = useCallback((id: string) => {
    return templateManager.getCategory(id);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<TemplateConfig>) => {
    templateManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return templateManager.getConfig();
}, []);

  // Get all templates
  const getAllTemplates = useCallback(() => {
    return templateManager.getAllTemplates();
}, []);

  // Get all categories
  const getAllCategories = useCallback(() => {
    return templateManager.getAllCategories();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    addTemplate,
    addCategory,
    searchTemplates,
    getTemplate,
    getTemplatesByType,
    getTemplatesByCategory,
    getCategory,
    state,
    config: currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    templates: Array.from(state.templates.values()),
    categories: Array.from(state.categories.values()),
    searchResults: state.searchResults,
    lastSearchQuery: state.lastSearchQuery,
    totalTemplates: state.totalTemplates,
    totalCategories: state.totalCategories,
    totalUsage: state.totalUsage,
    totalErrors: state.totalErrors,
    totalConflicts: state.totalConflicts,
    totalOverrides: state.totalOverrides,
    getAllTemplates,
    getAllCategories
}), [
    addTemplate,
    addCategory,
    searchTemplates,
    getTemplate,
    getTemplatesByType,
    getTemplatesByCategory,
    getCategory,
    state,
    currentConfig,
    updateConfig,
    getAllTemplates,
    getAllCategories
  ]);

  return returnValue;
};

export default useTemplate;
