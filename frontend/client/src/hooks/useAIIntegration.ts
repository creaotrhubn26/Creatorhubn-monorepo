/**
 * useAIIntegration Hook
 * React hook for AI integration functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  aiIntegrationManager, 
  AIConfig, 
  AIState, 
  AIPrompt,
  AIResponse,
  AIContext,
  AILearning,
  AIOptimization
} from'../utils/aiIntegrationManager';

export interface UseAIIntegrationOptions {
  config?: Partial<AIConfig>;
  onPromptCreated?: (data: { prompt: AIPrompt }) => void;
  onPromptExecuted?: (data: { prompt: AIPrompt; response: AIResponse }) => void;
  onPromptExecutionFailed?: (data: { prompt: AIPrompt; response: AIResponse; error: string }) => void;
  onContextCreated?: (data: { context: AIContext }) => void;
  onLearningCreated?: (data: { learning: AILearning }) => void;
  onOptimizationCreated?: (data: { optimization: AIOptimization }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UseAIIntegrationReturn {
  createPrompt: (promptData: Partial<AIPrompt>) => Promise<AIPrompt>;
  executePrompt: (promptId: string, input: string, context?: string[]) => Promise<AIResponse>;
  createContext: (contextData: Partial<AIContext>) => Promise<AIContext>;
  createLearning: (learningData: Partial<AILearning>) => Promise<AILearning>;
  createOptimization: (optimizationData: Partial<AIOptimization>) => Promise<AIOptimization>;
  state: AIState;
  config: AIConfig;
  updateConfig: (config: Partial<AIConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  prompts: AIPrompt[];
  responses: AIResponse[];
  contexts: AIContext[];
  learning: AILearning[];
  optimizations: AIOptimization[];
  totalPrompts: number;
  totalResponses: number;
  totalContexts: number;
  totalLearning: number;
  totalOptimizations: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  averageMemoryUsage: number;
  averageAccuracy: number;
  averageConfidence: number;
  totalTokens: number;
  totalCost: number;
  totalErrors: number
}

/**
 * Hook for AI integration functionality
 */
export const useAIIntegration = (options: UseAIIntegrationOptions = {}): UseAIIntegrationReturn => {
  const {
    config = {},
    onPromptCreated,
    onPromptExecuted,
    onPromptExecutionFailed,
    onContextCreated,
    onLearningCreated,
    onOptimizationCreated,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<AIState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    prompts: new Map(),
    responses: new Map(),
    contexts: new Map(),
    learning: new Map(),
    optimizations: new Map(),
    activePrompts:  [],
    activeResponses:  [],
    activeContexts:  [],
    activeLearning:  [],
    activeOptimizations:  [],
    lastUpdate:  0,
    totalPrompts:  0,
    totalResponses:  0,
    totalContexts:  0,
    totalLearning:  0,
    totalOptimizations:  0,
    totalExecutions:  0,
    successfulExecutions:  0,
    failedExecutions:  0,
    averageExecutionTime:  0,
    averageMemoryUsage:  0,
    averageAccuracy:  0,
    averageConfidence:  0,
    totalTokens:  0,
    totalCost:  0,
    totalErrors: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize AI integration manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      aiIntegrationManager.updateConfig(config);
  }

    // Setup event handlers
    const handlePromptCreated = (data: { prompt: AIPrompt }) => {
      if (onPromptCreated) {
        onPromptCreated(data);
    }
  };

    const handlePromptExecuted = (data: { prompt: AIPrompt; response: AIResponse }) => {
      if (onPromptExecuted) {
        onPromptExecuted(data);
    }
  };

    const handlePromptExecutionFailed = (data: { prompt: AIPrompt; response: AIResponse; error: string }) => {
      if (onPromptExecutionFailed) {
        onPromptExecutionFailed(data);
    }
  };

    const handleContextCreated = (data: { context: AIContext }) => {
      if (onContextCreated) {
        onContextCreated(data);
    }
  };

    const handleLearningCreated = (data: { learning: AILearning }) => {
      if (onLearningCreated) {
        onLearningCreated(data);
    }
  };

    const handleOptimizationCreated = (data: { optimization: AIOptimization }) => {
      if (onOptimizationCreated) {
        onOptimizationCreated(data);
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
    eventHandlersRef.current.set('prompt_created', handlePromptCreated);
    eventHandlersRef.current.set('prompt_executed', handlePromptExecuted);
    eventHandlersRef.current.set('prompt_execution_failed', handlePromptExecutionFailed);
    eventHandlersRef.current.set('context_created', handleContextCreated);
    eventHandlersRef.current.set('learning_created', handleLearningCreated);
    eventHandlersRef.current.set('optimization_created', handleOptimizationCreated);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    aiIntegrationManager.on('prompt_created', handlePromptCreated);
    aiIntegrationManager.on('prompt_executed', handlePromptExecuted);
    aiIntegrationManager.on('prompt_execution_failed', handlePromptExecutionFailed);
    aiIntegrationManager.on('context_created', handleContextCreated);
    aiIntegrationManager.on('learning_created', handleLearningCreated);
    aiIntegrationManager.on('optimization_created', handleOptimizationCreated);
    aiIntegrationManager.on('error', handleError);
    aiIntegrationManager.on('initialized', handleInitialized);

    // Update initial state
    setState(aiIntegrationManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        aiIntegrationManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onPromptCreated, onPromptExecuted, onPromptExecutionFailed, onContextCreated, onLearningCreated, onOptimizationCreated, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = aiIntegrationManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Create prompt
  const createPrompt = useCallback(async (promptData: Partial<AIPrompt>) => {
    return await aiIntegrationManager.createPrompt(promptData);
}, []);

  // Execute prompt
  const executePrompt = useCallback(async (promptId: string, input: string, context?: string[]) => {
    return await aiIntegrationManager.executePrompt(promptId, input, context);
}, []);

  // Create context
  const createContext = useCallback(async (contextData: Partial<AIContext>) => {
    return await aiIntegrationManager.createContext(contextData);
}, []);

  // Create learning
  const createLearning = useCallback(async (learningData: Partial<AILearning>) => {
    return await aiIntegrationManager.createLearning(learningData);
}, []);

  // Create optimization
  const createOptimization = useCallback(async (optimizationData: Partial<AIOptimization>) => {
    return await aiIntegrationManager.createOptimization(optimizationData);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<AIConfig>) => {
    aiIntegrationManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const config = useMemo(() => {
    return aiIntegrationManager.getConfig();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    createPrompt,
    executePrompt,
    createContext,
    createLearning,
    createOptimization,
    state,
    config,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    prompts: Array.from(state.prompts.values(, ), ),
    responses: Array.from(state.responses.values(, ), ),
    contexts: Array.from(state.contexts.values(, ), ),
    learning: Array.from(state.learning.values(, ), ),
    optimizations: Array.from(state.optimizations.values(, ), ),
    totalPrompts: state.totalPrompts,
    totalResponses: state.totalResponses,
    totalContexts: state.totalContexts,
    totalLearning: state.totalLearning,
    totalOptimizations: state.totalOptimizations,
    totalExecutions: state.totalExecutions,
    successfulExecutions: state.successfulExecutions,
    failedExecutions: state.failedExecutions,
    averageExecutionTime: state.averageExecutionTime,
    averageMemoryUsage: state.averageMemoryUsage,
    averageAccuracy: state.averageAccuracy,
    averageConfidence: state.averageConfidence,
    totalTokens: state.totalTokens,
    totalCost: state.totalCost,
    totalErrors: state.totalErrors
}), [
    createPrompt,
    executePrompt,
    createContext,
    createLearning,
    createOptimization,
    state,
    config,
    updateConfig
  ]);

  return returnValue;
};

export default useAIIntegration;





