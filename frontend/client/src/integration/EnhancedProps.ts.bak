/**
 * Enhanced Props System
 * Extends existing prop interfaces to support "everything interacts with everything"
 */

// Base integration props that all components can use
export interface BaseIntegrationProps {
  // Component identification
  componentId?: string;
  componentType?: string;
  
  // Integration capabilities
  integrationEnabled?: boolean;
  autoSync?: boolean;
  
  // Event handling
  onIntegrationEvent?: (event: string, data: any) => void;
  onDataChange?: (key: string, value: any) => void;
  
  // Cross-component communication
  onComponentAction?: (action: string, data: any) => void;
  onComponentUpdate?: (componentId: string, data: any) => void;
  
  // Data sharing
  sharedData?: Record<string, any>;
  onSharedDataUpdate?: (key: string, value: any) => void;
}

// Enhanced version of existing admin dashboard props
export interface EnhancedAdminDashboardProps extends BaseIntegrationProps {
  // Original props (kept for backward compatibility)
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
  
  // Extended communication props
  onUserAction?: (action: string, data: any) => void;
  onSystemAction?: (action: string, data: any) => void;
  onDataAction?: (action: string, data: any) => void;
  onUIAction?: (action: string, data: any) => void;
  
  // Real-time updates
  onRealtimeUpdate?: (type: string, data: any) => void;
  onLiveData?: (data: any) => void;
  
  // Cross-panel communication
  onPanelCommunication?: (fromPanel: string, toPanel: string, data: any) => void;
  onGlobalUpdate?: (updateType: string, data: any) => void;
  
  // Enhanced data flow
  onDataFlow?: (flowType: string, data: any) => void;
  onStateSync?: (state: any) => void;
  
  // Advanced interactions
  onAdvancedAction?: (actionType: string, payload: any) => void;
  onComplexInteraction?: (interaction: any) => void;
}

// Visual Editor specific enhanced props
export interface EnhancedVisualEditorProps extends BaseIntegrationProps {
  // Original visual editor props
  onElementSelect?: (element: any) => void;
  onElementUpdate?: (element: any) => void;
  onElementDelete?: (elementId: string) => void;
  onElementAdd?: (element: any) => void;
  onCanvasUpdate?: (canvas: any) => void;
  onProjectSave?: (project: any) => void;
  onProjectLoad?: (project: any) => void;
  
  // Enhanced visual editor interactions
  onDesignSystemUpdate?: (designSystem: any) => void;
  onComponentLibraryUpdate?: (library: any) => void;
  onTemplateUpdate?: (template: any) => void;
  onAnimationUpdate?: (animation: any) => void;
  onExportUpdate?: (exportData: any) => void;
  
  // Cross-editor communication
  onEditorSync?: (editorData: any) => void;
  onEditorCollaboration?: (collaboration: any) => void;
  onEditorVersionControl?: (version: any) => void;
}

// Dashboard specific enhanced props
export interface EnhancedDashboardProps extends BaseIntegrationProps {
  // Original dashboard props
  onDashboardUpdate?: (dashboard: any) => void;
  onWidgetUpdate?: (widget: any) => void;
  onLayoutUpdate?: (layout: any) => void;
  
  // Enhanced dashboard interactions
  onDashboardSync?: (syncData: any) => void;
  onDashboardCollaboration?: (collaboration: any) => void;
  onDashboardAnalytics?: (analytics: any) => void;
  onDashboardPerformance?: (performance: any) => void;
}

// Universal enhanced props for any component
export interface UniversalEnhancedProps extends BaseIntegrationProps {
  // Universal actions that any component can trigger
  onUniversalAction?: (action: string, data: any) => void;
  onUniversalUpdate?: (update: any) => void;
  onUniversalSync?: (sync: any) => void;
  
  // Universal data access
  onUniversalDataAccess?: (dataKey: string, callback: (data: any) => void) => void;
  onUniversalDataUpdate?: (dataKey: string, data: any) => void;
  
  // Universal communication
  onUniversalCommunication?: (message: any) => void;
  onUniversalBroadcast?: (broadcast: any) => void;
}

// Type for any component that can be enhanced
export type EnhancedComponent = React.ComponentType<any> & {
  enhancedProps?: string[];
  integrationCapabilities?: string[];
};

// Utility type to add integration props to existing components
export type WithIntegration<T> = T & BaseIntegrationProps;

// Pre-defined integration capabilities
export const INTEGRATION_CAPABILITIES = {
  // Data capabilities
  DATA_READ: 'data:read',
  DATA_WRITE: 'data:write',
  DATA_DELETE: 'data:delete',
  DATA_SYNC: 'data:sync',
  
  // Communication capabilities
  EVENT_EMIT: 'event:emit',
  EVENT_LISTEN: 'event:listen',
  MESSAGE_SEND: 'message:send',
  MESSAGE_RECEIVE: 'message:receive',
  
  // Action capabilities
  ACTION_EXECUTE: 'action:execute',
  ACTION_REGISTER: 'action:register',
  ACTION_TRIGGER: 'action:trigger',
  
  // UI capabilities
  UI_UPDATE: 'ui:update',
  UI_REFRESH: 'ui:refresh',
  UI_NOTIFY: 'ui:notify',
  
  // System capabilities
  SYSTEM_ACCESS: 'system:access',
  SYSTEM_CONTROL: 'system:control',
  SYSTEM_MONITOR: 'system:monitor', 
};

// Pre-defined component types for better integration
export const COMPONENT_TYPES = {
  DASHBOARD: 'dashboard',
  EDITOR: 'editor',
  PANEL: 'panel',
  WIDGET: 'widget',
  MODAL: 'modal',
  FORM: 'form',
  TABLE: 'table',
  CHART: 'chart',
  MAP: 'map',
  CALENDAR: 'calendar',
  CHAT: 'chat',
  NOTIFICATION: 'notification', 
};

export default {
  INTEGRATION_CAPABILITIES,
  COMPONENT_TYPES
};




