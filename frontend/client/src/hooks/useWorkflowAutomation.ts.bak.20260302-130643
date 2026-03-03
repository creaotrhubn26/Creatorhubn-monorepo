/**
 * useWorkflowAutomation Hook
 * React hook for workflow automation functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  workflowAutomationManager, 
  WorkflowConfig, 
  WorkflowState, 
  Workflow,
  WorkflowTemplate
} from'../utils/workflowAutomationManager';

export interface UseWorkflowAutomationOptions {
  config?: Partial<WorkflowConfig>;
  onWorkflowCreated?: (data: { workflow: Workflow }) => void;
  onWorkflowDeleted?: (data: { workflow: Workflow }) => void;
  onWorkflowExecuted?: (data: { workflow: Workflow }) => void;
  onWorkflowPaused?: (data: { workflow: Workflow }) => void;
  onWorkflowResumed?: (data: { workflow: Workflow }) => void;
  onWorkflowStopped?: (data: { workflow: Workflow }) => void;
  onWorkflowCompleted?: (data: { workflow: Workflow }) => void;
  onWorkflowFailed?: (data: { workflow: Workflow; error: string }) => void;
  onTemplateCreated?: (data: { template: WorkflowTemplate }) => void;
  onTemplateDeleted?: (data: { template: WorkflowTemplate }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UseWorkflowAutomationReturn {
  createWorkflow: (workflowData: Partial<Workflow>) => Promise<Workflow>;
  deleteWorkflow: (workflowId: string) => Promise<void>;
  executeWorkflow: (workflowId: string, variables?: Record<string, any>) => Promise<void>;
  pauseWorkflow: (workflowId: string) => Promise<void>;
  resumeWorkflow: (workflowId: string) => Promise<void>;
  stopWorkflow: (workflowId: string) => Promise<void>;
  createTemplate: (templateData: Partial<WorkflowTemplate>) => Promise<WorkflowTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;
  state: WorkflowState;
  config: WorkflowConfig;
  updateConfig: (config: Partial<WorkflowConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  workflows: Workflow[];
  templates: WorkflowTemplate[];
  activeWorkflows: Workflow[];
  runningWorkflows: Workflow[];
  pausedWorkflows: Workflow[];
  errorWorkflows: Workflow[];
  completedWorkflows: Workflow[];
  totalWorkflows: number;
  totalTemplates: number;
  activeWorkflowsCount: number;
  runningWorkflowsCount: number;
  pausedWorkflowsCount: number;
  errorWorkflowsCount: number;
  completedWorkflowsCount: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  averageMemoryUsage: number;
  averageCpuUsage: number;
  totalErrors: number;
  totalRetries: number
}

/**
 * Hook for workflow automation functionality
 */
export const useWorkflowAutomation = (options: UseWorkflowAutomationOptions = {}): UseWorkflowAutomationReturn => {
  const {
    config = {},
    onWorkflowCreated,
    onWorkflowDeleted,
    onWorkflowExecuted,
    onWorkflowPaused,
    onWorkflowResumed,
    onWorkflowStopped,
    onWorkflowCompleted,
    onWorkflowFailed,
    onTemplateCreated,
    onTemplateDeleted,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<WorkflowState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    workflows: new Map(),
    templates: new Map(),
    activeWorkflows:  [],
    runningWorkflows:  [],
    pausedWorkflows:  [],
    errorWorkflows:  [],
    completedWorkflows:  [],
    lastUpdate:  0,
    totalWorkflows:  0,
    totalTemplates:  0,
    activeWorkflowsCount:  0,
    runningWorkflowsCount:  0,
    pausedWorkflowsCount:  0,
    errorWorkflowsCount:  0,
    completedWorkflowsCount:  0,
    totalExecutions:  0,
    successfulExecutions:  0,
    failedExecutions:  0,
    averageExecutionTime:  0,
    averageMemoryUsage:  0,
    averageCpuUsage:  0,
    totalErrors:  0,
    totalRetries: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize workflow automation manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      workflowAutomationManager.updateConfig(config);
  }

    // Setup event handlers
    const handleWorkflowCreated = (data: { workflow: Workflow }) => {
      if (onWorkflowCreated) {
        onWorkflowCreated(data);
    }
  };

    const handleWorkflowDeleted = (data: { workflow: Workflow }) => {
      if (onWorkflowDeleted) {
        onWorkflowDeleted(data);
    }
  };

    const handleWorkflowExecuted = (data: { workflow: Workflow }) => {
      if (onWorkflowExecuted) {
        onWorkflowExecuted(data);
    }
  };

    const handleWorkflowPaused = (data: { workflow: Workflow }) => {
      if (onWorkflowPaused) {
        onWorkflowPaused(data);
    }
  };

    const handleWorkflowResumed = (data: { workflow: Workflow }) => {
      if (onWorkflowResumed) {
        onWorkflowResumed(data);
    }
  };

    const handleWorkflowStopped = (data: { workflow: Workflow }) => {
      if (onWorkflowStopped) {
        onWorkflowStopped(data);
    }
  };

    const handleWorkflowCompleted = (data: { workflow: Workflow }) => {
      if (onWorkflowCompleted) {
        onWorkflowCompleted(data);
    }
  };

    const handleWorkflowFailed = (data: { workflow: Workflow; error: string }) => {
      if (onWorkflowFailed) {
        onWorkflowFailed(data);
    }
  };

    const handleTemplateCreated = (data: { template: WorkflowTemplate }) => {
      if (onTemplateCreated) {
        onTemplateCreated(data);
    }
  };

    const handleTemplateDeleted = (data: { template: WorkflowTemplate }) => {
      if (onTemplateDeleted) {
        onTemplateDeleted(data);
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
    eventHandlersRef.current.set('workflow_created', handleWorkflowCreated);
    eventHandlersRef.current.set('workflow_deleted', handleWorkflowDeleted);
    eventHandlersRef.current.set('workflow_executed', handleWorkflowExecuted);
    eventHandlersRef.current.set('workflow_paused', handleWorkflowPaused);
    eventHandlersRef.current.set('workflow_resumed', handleWorkflowResumed);
    eventHandlersRef.current.set('workflow_stopped', handleWorkflowStopped);
    eventHandlersRef.current.set('workflow_completed', handleWorkflowCompleted);
    eventHandlersRef.current.set('workflow_failed', handleWorkflowFailed);
    eventHandlersRef.current.set('template_created', handleTemplateCreated);
    eventHandlersRef.current.set('template_deleted', handleTemplateDeleted);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    workflowAutomationManager.on('workflow_created', handleWorkflowCreated);
    workflowAutomationManager.on('workflow_deleted', handleWorkflowDeleted);
    workflowAutomationManager.on('workflow_executed', handleWorkflowExecuted);
    workflowAutomationManager.on('workflow_paused', handleWorkflowPaused);
    workflowAutomationManager.on('workflow_resumed', handleWorkflowResumed);
    workflowAutomationManager.on('workflow_stopped', handleWorkflowStopped);
    workflowAutomationManager.on('workflow_completed', handleWorkflowCompleted);
    workflowAutomationManager.on('workflow_failed', handleWorkflowFailed);
    workflowAutomationManager.on('template_created', handleTemplateCreated);
    workflowAutomationManager.on('template_deleted', handleTemplateDeleted);
    workflowAutomationManager.on('error', handleError);
    workflowAutomationManager.on('initialized', handleInitialized);

    // Update initial state
    setState(workflowAutomationManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        workflowAutomationManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onWorkflowCreated, onWorkflowDeleted, onWorkflowExecuted, onWorkflowPaused, onWorkflowResumed, onWorkflowStopped, onWorkflowCompleted, onWorkflowFailed, onTemplateCreated, onTemplateDeleted, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = workflowAutomationManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Create workflow
  const createWorkflow = useCallback(async (workflowData: Partial<Workflow>) => {
    return await workflowAutomationManager.createWorkflow(workflowData);
}, []);

  // Delete workflow
  const deleteWorkflow = useCallback(async (workflowId: string) => {
    await workflowAutomationManager.deleteWorkflow(workflowId);
}, []);

  // Execute workflow
  const executeWorkflow = useCallback(async (workflowId: string, variables?: Record<string, any>) => {
    await workflowAutomationManager.executeWorkflow(workflowId, variables);
}, []);

  // Pause workflow
  const pauseWorkflow = useCallback(async (workflowId: string) => {
    await workflowAutomationManager.pauseWorkflow(workflowId);
}, []);

  // Resume workflow
  const resumeWorkflow = useCallback(async (workflowId: string) => {
    await workflowAutomationManager.resumeWorkflow(workflowId);
}, []);

  // Stop workflow
  const stopWorkflow = useCallback(async (workflowId: string) => {
    await workflowAutomationManager.stopWorkflow(workflowId);
}, []);

  // Create template
  const createTemplate = useCallback(async (templateData: Partial<WorkflowTemplate>) => {
    return await workflowAutomationManager.createTemplate(templateData);
}, []);

  // Delete template
  const deleteTemplate = useCallback(async (templateId: string) => {
    await workflowAutomationManager.deleteTemplate(templateId);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<WorkflowConfig>) => {
    workflowAutomationManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const config = useMemo(() => {
    return workflowAutomationManager.getConfig();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    createWorkflow,
    deleteWorkflow,
    executeWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    stopWorkflow,
    createTemplate,
    deleteTemplate,
    state,
    config,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    workflows: Array.from(state.workflows.values()),
    templates: Array.from(state.templates.values()),
    activeWorkflows: state.activeWorkflows.map(id => state.workflows.get(id)).filter(Boolean) as Workflow[],
    runningWorkflows: state.runningWorkflows.map(id => state.workflows.get(id)).filter(Boolean) as Workflow[],
    pausedWorkflows: state.pausedWorkflows.map(id => state.workflows.get(id)).filter(Boolean) as Workflow[],
    errorWorkflows: state.errorWorkflows.map(id => state.workflows.get(id)).filter(Boolean) as Workflow[],
    completedWorkflows: state.completedWorkflows.map(id => state.workflows.get(id)).filter(Boolean) as Workflow[],
    totalWorkflows: state.totalWorkflows,
    totalTemplates: state.totalTemplates,
    activeWorkflowsCount: state.activeWorkflowsCount,
    runningWorkflowsCount: state.runningWorkflowsCount,
    pausedWorkflowsCount: state.pausedWorkflowsCount,
    errorWorkflowsCount: state.errorWorkflowsCount,
    completedWorkflowsCount: state.completedWorkflowsCount,
    totalExecutions: state.totalExecutions,
    successfulExecutions: state.successfulExecutions,
    failedExecutions: state.failedExecutions,
    averageExecutionTime: state.averageExecutionTime,
    averageMemoryUsage: state.averageMemoryUsage,
    averageCpuUsage: state.averageCpuUsage,
    totalErrors: state.totalErrors,
    totalRetries: state.totalRetries
}), [
    createWorkflow,
    deleteWorkflow,
    executeWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    stopWorkflow,
    createTemplate,
    deleteTemplate,
    state,
    config,
    updateConfig
  ]);

  return returnValue;
};

export default useWorkflowAutomation;





