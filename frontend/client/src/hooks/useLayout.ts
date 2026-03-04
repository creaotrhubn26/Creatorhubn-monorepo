/**
 * useLayout Hook
 * React hook for layout management functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { 
  LayoutConfig, 
  LayoutState, 
  LayoutElement,
  LayoutRule
} from '../utils/layoutManager';
import { 
  layoutManager
} from'../utils/layoutManager';

export interface UseLayoutOptions {
  config?: Partial<LayoutConfig>;
  onElementRegistered?: (data: { element: LayoutElement }) => void;
  onRuleCreated?: (data: { rule: LayoutRule }) => void;
  onLayoutApplied?: (data: { element: LayoutElement }) => void;
  onLayoutApplyFailed?: (data: { element: LayoutElement; error: string }) => void;
  onRuleExecutionFailed?: (data: { rule: LayoutRule; element: LayoutElement; error: string }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UseLayoutReturn {
  registerElement: (elementData: Partial<LayoutElement>) => Promise<LayoutElement>;
  createRule: (ruleData: Partial<LayoutRule>) => Promise<LayoutRule>;
  applyLayout: (elementId: string) => Promise<void>;
  state: LayoutState;
  config: LayoutConfig;
  updateConfig: (config: Partial<LayoutConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  elements: LayoutElement[];
  rules: LayoutRule[];
  activeElements: LayoutElement[];
  totalElements: number;
  totalRules: number;
  totalLayouts: number;
  successfulLayouts: number;
  failedLayouts: number;
  averageLayoutTime: number;
  averageRenderTime: number;
  averageOptimizationTime: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number;
  getElements: () => LayoutElement[];
  getRules: () => LayoutRule[]
}

/**
 * Hook for layout management functionality
 */
export const useLayout = (options: UseLayoutOptions = {}): UseLayoutReturn => {
  const {
    config: optionConfig = {},
    onElementRegistered,
    onRuleCreated,
    onLayoutApplied,
    onLayoutApplyFailed,
    onRuleExecutionFailed,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<LayoutState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    elements: new Map(),
    rules: new Map(),
    activeElements: new Map(),
    lastUpdate:  0,
    totalElements:  0,
    totalRules:  0,
    totalLayouts:  0,
    successfulLayouts:  0,
    failedLayouts:  0,
    averageLayoutTime:  0,
    averageRenderTime:  0,
    averageOptimizationTime:  0,
    totalErrors:  0,
    totalConflicts:  0,
    totalOverrides: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize layout manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(optionConfig).length > 0) {
      layoutManager.updateConfig(optionConfig);
  }

    // Setup event handlers
    const handleElementRegistered = (data: { element: LayoutElement }) => {
      if (onElementRegistered) {
        onElementRegistered(data);
    }
  };

    const handleRuleCreated = (data: { rule: LayoutRule }) => {
      if (onRuleCreated) {
        onRuleCreated(data);
    }
  };

    const handleLayoutApplied = (data: { element: LayoutElement }) => {
      if (onLayoutApplied) {
        onLayoutApplied(data);
    }
  };

    const handleLayoutApplyFailed = (data: { element: LayoutElement; error: string }) => {
      if (onLayoutApplyFailed) {
        onLayoutApplyFailed(data);
    }
  };

    const handleRuleExecutionFailed = (data: { rule: LayoutRule; element: LayoutElement; error: string }) => {
      if (onRuleExecutionFailed) {
        onRuleExecutionFailed(data);
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
    eventHandlersRef.current.set('element_registered', handleElementRegistered);
    eventHandlersRef.current.set('rule_created', handleRuleCreated);
    eventHandlersRef.current.set('layout_applied', handleLayoutApplied);
    eventHandlersRef.current.set('layout_apply_failed', handleLayoutApplyFailed);
    eventHandlersRef.current.set('rule_execution_failed', handleRuleExecutionFailed);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    layoutManager.on('element_registered', handleElementRegistered);
    layoutManager.on('rule_created', handleRuleCreated);
    layoutManager.on('layout_applied', handleLayoutApplied);
    layoutManager.on('layout_apply_failed', handleLayoutApplyFailed);
    layoutManager.on('rule_execution_failed', handleRuleExecutionFailed);
    layoutManager.on('error', handleError);
    layoutManager.on('initialized', handleInitialized);

    // Update initial state
    setState(layoutManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        layoutManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [optionConfig, onElementRegistered, onRuleCreated, onLayoutApplied, onLayoutApplyFailed, onRuleExecutionFailed, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = layoutManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Register element
  const registerElement = useCallback(async (elementData: Partial<LayoutElement>) => {
    return await layoutManager.registerElement(elementData);
}, []);

  // Create rule
  const createRule = useCallback(async (ruleData: Partial<LayoutRule>) => {
    return await layoutManager.createRule(ruleData);
}, []);

  // Apply layout
  const applyLayout = useCallback(async (elementId: string) => {
    await layoutManager.applyLayout(elementId);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<LayoutConfig>) => {
    layoutManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return layoutManager.getConfig();
}, []);

  // Get elements
  const getElements = useCallback(() => {
    return layoutManager.getElements();
}, []);

  // Get rules
  const getRules = useCallback(() => {
    return layoutManager.getRules();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    registerElement,
    createRule,
    applyLayout,
    state,
    config: currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    elements: Array.from(state.elements.values()),
    rules: Array.from(state.rules.values()),
    activeElements: Array.from(state.activeElements.values()),
    totalElements: state.totalElements,
    totalRules: state.totalRules,
    totalLayouts: state.totalLayouts,
    successfulLayouts: state.successfulLayouts,
    failedLayouts: state.failedLayouts,
    averageLayoutTime: state.averageLayoutTime,
    averageRenderTime: state.averageRenderTime,
    averageOptimizationTime: state.averageOptimizationTime,
    totalErrors: state.totalErrors,
    totalConflicts: state.totalConflicts,
    totalOverrides: state.totalOverrides,
    getElements,
    getRules
}), [
    registerElement,
    createRule,
    applyLayout,
    state,
    currentConfig,
    updateConfig,
    getElements,
    getRules
  ]);

  return returnValue;
};

export default useLayout;




