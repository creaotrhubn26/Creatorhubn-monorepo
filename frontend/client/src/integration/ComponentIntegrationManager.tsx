/**
 * Component Integration Manager
 * Connects all existing components without refactoring them
 * Enables "everything interacts with everything" functionality
 */

import React, { createContext, useContext, useCallback, useRef } from 'react';

// Global event system for cross-component communication
class IntegrationEventBus {
  private listeners: Map<string, Set<Function>> = new Map();

  emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data));
  }
}

  on(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
  }
    this.listeners.get(event)!.add(listener);
}

  off(event: string, listener: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
  }
}
}

// Global data sharing system
class IntegrationDataStore {
  private data: Map<string, any> = new Map();
  private subscribers: Map<string, Set<Function>> = new Map();

  set(key: string, value: any) {
    this.data.set(key, value);
    this.notifySubscribers(key, value);
}

  get(key: string) {
    return this.data.get(key);
}

  subscribe(key: string, callback: Function) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
  }
    this.subscribers.get(key)!.add(callback);
}

  unsubscribe(key: string, callback: Function) {
    const keySubscribers = this.subscribers.get(key);
    if (keySubscribers) {
      keySubscribers.delete(callback);
  }
}

  private notifySubscribers(key: string, value: any) {
    const keySubscribers = this.subscribers.get(key);
    if (keySubscribers) {
      keySubscribers.forEach(callback => callback(value));
  }
}
}

// Global action system for cross-component actions
class IntegrationActionManager {
  private actions: Map<string, Function> = new Map();

  register(actionName: string, action: Function) {
    this.actions.set(actionName, action);
}

  execute(actionName: string, ...args: any[]) {
    const action = this.actions.get(actionName);
    if (action) {
      return action(...args);
  }
    console.warn(`Action ${actionName} not found`);
}

  getAvailableActions() {
    return Array.from(this.actions.keys());
}
}

// Create global instances
const eventBus = new IntegrationEventBus();
const dataStore = new IntegrationDataStore();
const actionManager = new IntegrationActionManager();

// Integration Context
interface IntegrationContextType {
  // Event system
  emit: (event: string, data?: any) => void;
  on: (event: string, listener: Function) => void;
  off: (event: string, listener: Function) => void;
  
  // Data system
  setData: (key: string, value: any) => void;
  getData: (key: string) => any;
  subscribe: (key: string, callback: Function) => void;
  unsubscribe: (key: string, callback: Function) => void;
  
  // Action system
  registerAction: (actionName: string, action: Function) => void;
  executeAction: (actionName: string, ...args: any[]) => any;
  getAvailableActions: () => string[]
}

const IntegrationContext = createContext<IntegrationContextType | null>(null);

// Integration Provider Component
export const IntegrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const contextValue: IntegrationContextType = {
    // Event system
    emit: useCallback((event: string, data?: any) => {
      eventBus.emit(event, data);
  }, []),
    
    on: useCallback((event: string, listener: Function) => {
      eventBus.on(event, listener);
  }, []),
    
    off: useCallback((event: string, listener: Function) => {
      eventBus.off(event, listener);
  }, []),
    
    // Data system
    setData: useCallback((key: string, value: any) => {
      dataStore.set(key, value);
  }, []),
    
    getData: useCallback((key: string) => {
      return dataStore.get(key);
  }, []),
    
    subscribe: useCallback((key: string, callback: Function) => {
      dataStore.subscribe(key, callback);
  }, []),
    
    unsubscribe: useCallback((key: string, callback: Function) => {
      dataStore.unsubscribe(key, callback);
  }, []),
    
    // Action system
    registerAction: useCallback((actionName: string, action: Function) => {
      actionManager.register(actionName, action);
  }, []),
    
    executeAction: useCallback((actionName: string, ...args: any[]) => {
      return actionManager.execute(actionName, ...args);
  }, []),
    
    getAvailableActions: useCallback(() => {
      return actionManager.getAvailableActions();
  }, [])
};

  return (
    <IntegrationContext.Provider value={contextValue}>
      {children}
    </IntegrationContext.Provider>
  );
};

// Hook to use integration system
export const useIntegration = () => {
  const context = useContext(IntegrationContext);
  if (!context) {
    throw new Error('useIntegration must be used within IntegrationProvider');
}
  return context;
};

// Enhanced props interface that includes integration capabilities
export interface EnhancedComponentProps {
  // Original props
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
  
  // Integration capabilities
  componentId?: string;
  integrationEnabled?: boolean
}

// HOC to add integration capabilities to existing components
export const withIntegration = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return React.forwardRef<any, P & EnhancedComponentProps>((props) => {
    const integration = useIntegration();
    
    // Enhanced props that include integration capabilities
    const enhancedProps = {
      ...props,
      integration,
      componentId: props.componentId || Component.displayName || 'Unknown',
      integrationEnabled: props.integrationEnabled !== false
  };
    const componentProps = enhancedProps as P;

    return <Component {...componentProps} />;
});
};

// Pre-defined integration events for common interactions
export const INTEGRATION_EVENTS = {
  // Data events
  DATA_UPDATED: 'data:updated',
  DATA_CREATED: 'data:created',
  DATA_DELETED: 'data:deleted',
  
  // User events
  USER_SELECTED: 'user:selected',
  USER_UPDATED: 'user:updated',
  USER_CREATED: 'user:created',
  
  // Project events
  PROJECT_SELECTED: 'project:selected',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_CREATED: 'project:created',
  
  // Client events
  CLIENT_SELECTED: 'client:selected',
  CLIENT_UPDATED: 'client:updated',
  CLIENT_CREATED: 'client:created',
  
  // File events
  FILE_UPLOADED: 'file:uploaded',
  FILE_DOWNLOADED: 'file:downloaded',
  FILE_DELETED: 'file:deleted',
  
  // Notification events
  NOTIFICATION_CREATED: 'notification:created',
  NOTIFICATION_READ: 'notification:read',
  
  // Settings events
  SETTINGS_UPDATED: 'settings:updated',
  
  // System events
  SYSTEM_REFRESH: 'system:refresh',
  SYSTEM_ERROR: 'system:error',
  SYSTEM_SUCCESS: 'system:success', 
};

// Pre-defined data keys for common data sharing
export const DATA_KEYS = {
  SELECTED_USER: 'selectedUser',
  SELECTED_PROJECT: 'selectedProject',
  SELECTED_CLIENT: 'selectedClient',
  CURRENT_THEME: 'currentTheme',
  USER_PERMISSIONS: 'userPermissions',
  SYSTEM_STATUS: 'systemStatus',
  NOTIFICATIONS: 'notifications',
  RECENT_ACTIVITIES: ', '
};

// Pre-defined actions for common operations
export const ACTIONS = {
  REFRESH_DATA: 'refreshData',
  SAVE_DATA: 'saveData',
  DELETE_DATA: 'deleteData',
  EXPORT_DATA: 'exportData',
  IMPORT_DATA: 'importData',
  VALIDATE_DATA: 'validateData',
  NOTIFY_USER: 'notifyUser',
  LOG_ACTIVITY: ''
};

export default IntegrationProvider;


