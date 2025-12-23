/**
 * useTemplate Hook
 * React hook for template management functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  templateManager, 
  TemplateConfig, 
  TemplateManagerState, 
  Template,
  TemplateCategory,
  TemplateSearchQuery
} from'../utils/templateManager';

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
    config = {},
    onTemplateAdded,
    onCategoryAdded,
    onSearchCompleted,
    onSearchFailed,
    onError,
    onInitialized
  } = options;

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
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

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

    // Store event handlers
    eventHandlersRef.current.set('template_added', handleTemplateAdded);
    eventHandlersRef.current.set('category_added', handleCategoryAdded);
    eventHandlersRef.current.set('search_completed', handleSearchCompleted);
    eventHandlersRef.current.set('search_failed', handleSearchFailed);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

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
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        templateManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onTemplateAdded, onCategoryAdded, onSearchCompleted, onSearchFailed, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = templateManager.getState();
      setState(currentState);
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
    return templateManager.getTemplate(id);
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



