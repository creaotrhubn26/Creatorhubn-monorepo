/**
 * Visual Editor Context Provider
 * Unified data context for all visual editor components to communicate
 */

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';

// Types for the visual editor context
export interface EditorElement {
  id: string;
  type: 'button' | 'text' | 'image' | 'card' | 'container' | 'grid' | 'audio' | 'video';
  x: number;
  y: number;
  width: number;
  height: number;
  styles: {
    backgroundColor?: string;
    color?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    fontSize?: string;
    fontWeight?: string;
    lineHeight?: string;
    transform?: string;
    textShadow?: string;
    opacity?: number;
    boxShadow?: string;
    border?: string;
    display?: string;
    gap?: string;
    fontFamily?: string;
    fontStyle?: string;
    textStroke?: string;
};
  props: Record<string, any>;
  children?: string[];
  parent?: string;
  icon?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'project' | 'workflow' | 'dashboard' | 'ui' | 'showcase';
  elements: EditorElement[];
  metadata: {
    createdBy: string;
    createdAt: Date;
    downloads: number;
    rating: number;
    featured: boolean;
};
  tags: string[];
  preview?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  elements: EditorElement[];
  settings: {
    width: number;
    height: number;
    backgroundColor: string;
    gridSize: number;
    snapToGrid: boolean;
};
  metadata: {
    createdBy: string;
    createdAt: Date;
    lastModified: Date;
    version: number;
};
  collaborators?: string[];
  status: 'draft' | 'review' | 'published' | 'archived';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar?: string;
  permissions: string[];
}

export interface CollaborationSession {
  id: string;
  projectId: string;
  users: User[];
  activeUsers: string[];
  cursors: Record<string, { x: number; y: number; color: string }>;
  selections: Record<string, string[]>;
  lastActivity: Date;
}

export interface AnalyticsData {
  projectId: string;
  views: number;
  interactions: number;
  timeSpent: number;
  userActions: Array<{
    action: string;
    timestamp: Date;
    userId: string;
    elementId?: string;
}>;
  performance: {
    loadTime: number;
    renderTime: number;
    memoryUsage: number;
};
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    callback: () => void;
};
}

// State interface
export interface VisualEditorState {
  // Core editor state
  selectedElement: string | null;
  selectedElements: string[];
  elements: EditorElement[];
  clipboard: EditorElement[];
  history: EditorElement[][];
  historyIndex: number;
  
  // Project state
  currentProject: Project | null;
  projects: Project[];
  templates: Template[];
  
  // UI state
  activeTab: string;
  sidebarOpen: boolean;
  propertiesOpen: boolean;
  gridVisible: boolean;
  snapToGrid: boolean;
  zoom: number;
  pan: { x: number; y: number };
  
  // Collaboration state
  collaborationSession: CollaborationSession | null;
  onlineUsers: User[];
  cursors: Record<string, { x: number; y: number; color: string }>;
  
  // Analytics state
  analytics: AnalyticsData | null;
  performanceMetrics: {
    fps: number;
    memoryUsage: number;
    renderTime: number;
};
  
  // Notifications
  notifications: Notification[];
  
  // Settings
  settings: {
    autoSave: boolean;
    autoSaveInterval: number;
    theme: 'light' | 'dark';
    language: string;
    shortcuts: Record<string, string>;
};
  
  // Loading states
  loading: {
    project: boolean;
    templates: boolean;
    collaboration: boolean;
    analytics: boolean;
};
  
  // Error states
  errors: {
    project: string | null;
    templates: string | null;
    collaboration: string | null;
    analytics: string | null;
};
}

// Action types
export type VisualEditorAction =
  | { type: 'SET_SELECTED_ELEMENT'; payload: string | null }
  | { type: 'SET_SELECTED_ELEMENTS'; payload: string[] }
  | { type: 'ADD_ELEMENT'; payload: EditorElement }
  | { type: 'UPDATE_ELEMENT'; payload: { id: string; updates: Partial<EditorElement> } }
  | { type: 'DELETE_ELEMENT'; payload: string }
  | { type: 'DUPLICATE_ELEMENT'; payload: string }
  | { type: 'COPY_ELEMENTS'; payload: string[] }
  | { type: 'PASTE_ELEMENTS'; payload: { x: number; y: number } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_CURRENT_PROJECT'; payload: Project | null }
  | { type: 'UPDATE_PROJECT'; payload: Partial<Project> }
  | { type: 'SET_TEMPLATES'; payload: Template[] }
  | { type: 'ADD_TEMPLATE'; payload: Template }
  | { type: 'UPDATE_TEMPLATE'; payload: { id: string; updates: Partial<Template> } }
  | { type: 'DELETE_TEMPLATE'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_SIDEBAR_OPEN'; payload: boolean }
  | { type: 'SET_PROPERTIES_OPEN'; payload: boolean }
  | { type: 'SET_GRID_VISIBLE'; payload: boolean }
  | { type: 'SET_SNAP_TO_GRID'; payload: boolean }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_PAN'; payload: { x: number; y: number } }
  | { type: 'SET_COLLABORATION_SESSION'; payload: CollaborationSession | null }
  | { type: 'UPDATE_CURSORS'; payload: Record<string, { x: number; y: number; color: string }> }
  | { type: 'SET_ONLINE_USERS'; payload: User[] }
  | { type: 'SET_ANALYTICS'; payload: AnalyticsData | null }
  | { type: 'UPDATE_PERFORMANCE_METRICS'; payload: Partial<VisualEditorState['performanceMetrics']> }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<VisualEditorState['settings']> }
  | { type: 'SET_LOADING'; payload: { key: keyof VisualEditorState['loading']; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: keyof VisualEditorState['errors']; value: string | null } }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: VisualEditorState = {
  selectedElement: null,
  selectedElements:  [],
  elements:  [],
  clipboard:  [],
  history: [[]],
  historyIndex:  0,
  currentProject: null,
  projects:  [],
  templates:  [],
  activeTab: 'elements',
  sidebarOpen: true,
  propertiesOpen: true,
  gridVisible: true,
  snapToGrid: true,
  zoom: 1,
  pan: { x: 0, y: 0 },
  collaborationSession: null,
  onlineUsers: [],
  cursors: {},
  analytics: null,
  performanceMetrics: {
    fps: 60,
    memoryUsage: 0,
    renderTime: 0
  },
  notifications: [],
  settings: {
    autoSave: true,
    autoSaveInterval: 500,
    theme: 'light',
    language: 'en',
    shortcuts: {}
  },
  loading: {
    project: false,
    templates: false,
    collaboration: false,
    analytics: false
  },
  errors: {
    project: null,
    templates: null,
    collaboration: null,
    analytics: null
}
};

// Reducer
function visualEditorReducer(state: VisualEditorState, action: VisualEditorAction): VisualEditorState {
  switch (action.type) {
    case 'SET_SELECTED_ELEMENT':
      return { ...state, selectedElement: action.payload };
    
    case 'SET_SELECTED_ELEMENTS':
      return { ...state, selectedElements: action.payload };
    
    case 'ADD_ELEMENT':
      const newElements = [...state.elements, action.payload];
      return {
        ...state,
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1 };
    
    case 'UPDATE_ELEMENT':
      const updatedElements = state.elements.map(el =>
        el.id === action.payload.id ? { ...el, ...action.payload.updates } : el
      );
      return {
        ...state,
        elements: updatedElements,
        history: [...state.history.slice(0, state.historyIndex + 1), updatedElements],
        historyIndex: state.historyIndex + 1 };
    
    case 'DELETE_ELEMENT':
      const filteredElements = state.elements.filter(el => el.id !== action.payload);
      return {
        ...state,
        elements: filteredElements,
        selectedElement: state.selectedElement === action.payload ? null : state.selectedElement,
        selectedElements: state.selectedElements.filter(id => id !== action.payload),
        history: [...state.history.slice(0, state.historyIndex + 1), filteredElements],
        historyIndex: state.historyIndex + 1 };
    
    case 'DUPLICATE_ELEMENT':
      const elementToDuplicate = state.elements.find(el => el.id === action.payload);
      if (elementToDuplicate) {
        const duplicatedElement = {
          ...elementToDuplicate,
          id: `element-${Date.now()}`,
          x: elementToDuplicate.x + 20,
          y: elementToDuplicate.y + 20 };
        const elementsWithDuplicate = [...state.elements, duplicatedElement];
        return {
          ...state,
          elements: elementsWithDuplicate,
          history: [...state.history.slice(0, state.historyIndex + 1), elementsWithDuplicate],
          historyIndex: state.historyIndex + 1 };
    }
      return state;
    
    case 'COPY_ELEMENTS':
      const elementsToCopy = state.elements.filter(el => action.payload.includes(el.id));
      return { ...state, clipboard: elementsToCopy };
    
    case 'PASTE_ELEMENTS':
      const pastedElements = state.clipboard.map(el => ({
        ...el,
        id: `element-${Date.now()}-${Math.random()}`,
        x: el.x + action.payload.x,
        y: el.y + action.payload.y
  }));
      const elementsWithPasted = [...state.elements, ...pastedElements];
      return {
        ...state,
        elements: elementsWithPasted,
        history: [...state.history.slice(0, state.historyIndex + 1), elementsWithPasted],
        historyIndex: state.historyIndex + 1 };
    
    case 'UNDO':
      if (state.historyIndex > 0) {
        return {
          ...state,
          elements: state.history[state.historyIndex - 1],
          historyIndex: state.historyIndex - 1 };
    }
      return state;
    
    case 'REDO':
      if (state.historyIndex < state.history.length - 1) {
        return {
          ...state,
          elements: state.history[state.historyIndex + 1],
          historyIndex: state.historyIndex + 1 };
    }
      return state;
    
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProject: action.payload };
    
    case 'UPDATE_PROJECT':
      return {
        ...state,
        currentProject: state.currentProject ? { ...state.currentProject, ...action.payload } : null
    };
    
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };
    
    case 'ADD_TEMPLATE':
      return { ...state, templates: [...state.templates, action.payload] };
    
    case 'UPDATE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.map(template =>
          template.id === action.payload.id ? { ...template, ...action.payload.updates } : template
        )
    };
    
    case 'DELETE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.filter(template => template.id !== action.payload)
  };
    
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    
    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.payload };
    
    case 'SET_PROPERTIES_OPEN':
      return { ...state, propertiesOpen: action.payload };
    
    case 'SET_GRID_VISIBLE':
      return { ...state, gridVisible: action.payload };
    
    case 'SET_SNAP_TO_GRID':
      return { ...state, snapToGrid: action.payload };
    
    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };
    
    case 'SET_PAN':
      return { ...state, pan: action.payload };
    
    case 'SET_COLLABORATION_SESSION':
      return { ...state, collaborationSession: action.payload };
    
    case 'UPDATE_CURSORS':
      return { ...state, cursors: action.payload };
    
    case 'SET_ONLINE_USERS':
      return { ...state, onlineUsers: action.payload };
    
    case 'SET_ANALYTICS':
      return { ...state, analytics: action.payload };
    
    case 'UPDATE_PERFORMANCE_METRICS':
      return {
        ...state,
        performanceMetrics: { ...state.performanceMetrics, ...action.payload }
    };
    
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(notification => notification.id !== action.payload)
  };
    
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload ? { ...notification, read: true } : notification
        )
    };
    
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
    };
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.payload.key]: action.payload.value }
    };
    
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.key]: action.payload.value }
    };
    
    case 'RESET_STATE':
      return initialState;
    
    default: return state;
}
}

// Context
const VisualEditorContext = createContext<{
  state: VisualEditorState;
  dispatch: React.Dispatch<VisualEditorAction>;
  // Helper functions
  addElement: (element: Omit<EditorElement, 'id'>) => void;
  updateElement: (id: string, updates: Partial<EditorElement>) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  selectElements: (ids: string[]) => void;
  copyElements: (ids: string[]) => void;
  pasteElements: (x: number, y: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  addToast: (toast: { message: string; type: 'success' | 'error' | 'warning' | 'info'; duration?: number; actions?: Array<{label: string; action: () => void}> }) => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  setActiveTab: (tab: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setPropertiesOpen: (open: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  loadProject: (project: Project) => void;
  saveProject: () => void;
  createTemplate: (template: Omit<Template, 'id' | 'metadata'>) => void;
  loadTemplate: (templateId: string) => void;
  updateSettings: (settings: Partial<VisualEditorState['settings']>) => void;
} | null>(null);

// Provider component
export function VisualEditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(visualEditorReducer, initialState);
  const { integration, communication, dataFlow } = useEnhancedMasterIntegration();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper functions
  const addElement = useCallback((element: Omit<EditorElement, 'id'>) => {
    const newElement: EditorElement = {
      ...element,
      id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    dispatch({ type: 'ADD_ELEMENT', payload: newElement });

    // Broadcast to other components
    communication.sendBroadcast('element:added', { element: newElement });
    dataFlow.syncData('visual-editor:elements', state.elements.concat(newElement));
  }, [communication, dataFlow, state.elements]);

  const updateElement = useCallback((id: string, updates: Partial<EditorElement>) => {
    dispatch({ type: 'UPDATE_ELEMENT', payload: { id, updates } });

    // Broadcast to other components
    communication.sendBroadcast('element:updated', { id, updates });
    dataFlow.syncData('visual-editor:elements', state.elements.map(el =>
      el.id === id ? { ...el, ...updates } : el
    ));
  }, [communication, dataFlow, state.elements]);

  const deleteElement = useCallback((id: string) => {
    dispatch({ type: 'DELETE_ELEMENT', payload: id });

    // Broadcast to other components
    communication.sendBroadcast('element:deleted', { id });
    dataFlow.syncData('visual-editor:elements', state.elements.filter(el => el.id !== id));
  }, [communication, dataFlow, state.elements]);

  const duplicateElement = useCallback((id: string) => {
    dispatch({ type: 'DUPLICATE_ELEMENT', payload: id });
}, []);

  const selectElement = useCallback((id: string | null) => {
    dispatch({ type: 'SET_SELECTED_ELEMENT', payload: id });
    
    // Broadcast to other components
    communication.sendBroadcast('element: selected', { id });
    dataFlow.syncData('visual-editor: selectedElement', id);
}, [communication, dataFlow]);

  const selectElements = useCallback((ids: string[]) => {
    dispatch({ type: 'SET_SELECTED_ELEMENTS', payload: ids });
    
    // Broadcast to other components
    communication.sendBroadcast('elements:selected', { ids });
    dataFlow.syncData('visual-editor:selectedElements', ids);
}, [communication, dataFlow]);

  const copyElements = useCallback((ids: string[]) => {
    dispatch({ type: 'COPY_ELEMENTS', payload: ids });
}, []);

  const pasteElements = useCallback((x: number, y: number) => {
    dispatch({ type: 'PASTE_ELEMENTS', payload: { x, y } });
}, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
}, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });
  }, []);

  const addToast = useCallback((toast: { message: string; type: 'success' | 'error' | 'warning' | 'info'; duration?: number; actions?: Array<{label: string; action: () => void}> }) => {
    const newNotification: Notification = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: toast.type,
      title: toast.type.charAt(0).toUpperCase() + toast.type.slice(1),
      message: toast.message,
      timestamp: new Date(),
      read: false,
      action: toast.actions && toast.actions.length > 0 ? {
        label: toast.actions[0].label,
        callback: toast.actions[0].action
      } : undefined
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });
  }, []);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });

    // Broadcast to other components
    communication.sendBroadcast('tab:changed', { tab });
    dataFlow.syncData('visual-editor:activeTab', tab);
  }, [communication, dataFlow]);

  const setSidebarOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_SIDEBAR_OPEN', payload: open });
}, []);

  const setPropertiesOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_PROPERTIES_OPEN', payload: open });
}, []);

  const setGridVisible = useCallback((visible: boolean) => {
    dispatch({ type: 'SET_GRID_VISIBLE', payload: visible });
}, []);

  const setSnapToGrid = useCallback((snap: boolean) => {
    dispatch({ type: 'SET_SNAP_TO_GRID', payload: snap });
}, []);

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: 'SET_ZOOM', payload: zoom });
}, []);

  const setPan = useCallback((x: number, y: number) => {
    dispatch({ type: 'SET_PAN', payload: { x, y } });
}, []);

  const loadProject = useCallback((project: Project) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: project });
    dispatch({ type: 'SET_SELECTED_ELEMENT', payload: null });
    dispatch({ type: 'SET_SELECTED_ELEMENTS', payload: [] });
    
    // Broadcast to other components
    communication.sendBroadcast('project: loaded', { project });
    dataFlow.syncData('visual-editor: currentProject', project);
}, [communication, dataFlow]);

  const saveProject = useCallback(() => {
    if (state.currentProject) {
      const updatedProject = {
        ...state.currentProject,
        elements: state.elements,
        metadata: {
          ...state.currentProject.metadata,
          lastModified: new Date(),
          version: state.currentProject.metadata.version + 1 }
    };
      dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
      
      // Broadcast to other components
      communication.sendBroadcast('project:saved', { project: updatedProject });
      dataFlow.syncData('visual-editor:currentProject', updatedProject);
  }
  }, [state.currentProject, state.elements, communication, dataFlow]);

  const createTemplate = useCallback((template: Omit<Template, 'id' | 'metadata'>) => {
    const newTemplate: Template = {
      ...template,
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        createdBy: 'current-user', // TODO: Get from auth context
        createdAt: new Date(),
        downloads: 0,
        rating: 0,
        featured: false
      }
    };
    dispatch({ type: 'ADD_TEMPLATE', payload: newTemplate });

    // Broadcast to other components
    communication.sendBroadcast('template:created', { template: newTemplate });
    dataFlow.syncData('visual-editor:templates', state.templates.concat(newTemplate));
  }, [communication, dataFlow, state.templates]);

  const loadTemplate = useCallback((templateId: string) => {
    const template = state.templates.find(t => t.id === templateId);
    if (template) {
      dispatch({ type: 'SET_SELECTED_ELEMENT', payload: null });
      dispatch({ type: 'SET_SELECTED_ELEMENTS', payload: [] });
      
      // Broadcast to other components
      communication.sendBroadcast('template: loaded', { template });
      dataFlow.syncData('visual-editor: currentTemplate', template);
  }
}, [state.templates, communication, dataFlow]);

  const updateSettings = useCallback((settings: Partial<VisualEditorState['settings']>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    
    // Broadcast to other components
    communication.sendBroadcast('settings:updated', { settings });
    dataFlow.syncData('visual-editor:settings', { ...state.settings, ...settings });
}, [communication, dataFlow, state.settings]);

  // Auto-save functionality
  useEffect(() => {
    if (state.settings.autoSave && state.currentProject) {
      autoSaveIntervalRef.current = setInterval(() => {
        saveProject();
    }, state.settings.autoSaveInterval);
  }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [state.settings.autoSave, state.settings.autoSaveInterval, state.currentProject, saveProject]);

  // Listen for external changes
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      switch (message.type) {
        case 'element:added':
          // Handle external element addition
          if (message.data && message.data.element) {
            dispatch({ type: 'ADD_ELEMENT', payload: message.data.element });
          }
          break;
        case 'element:updated':
          // Handle external element updates
          if (message.data && message.data.id && message.data.updates) {
            dispatch({ type: 'UPDATE_ELEMENT', payload: { id: message.data.id, updates: message.data.updates } });
          }
          break;
        case 'element:deleted':
          // Handle external element deletion
          if (message.data && message.data.id) {
            dispatch({ type: 'DELETE_ELEMENT', payload: message.data.id });
          }
          break;
        case 'project:loaded':
          // Handle external project loading
          if (message.data && message.data.project) {
            dispatch({ type: 'SET_CURRENT_PROJECT', payload: message.data.project });
          }
          break;
        case 'template:loaded':
          // Handle external template loading
          if (message.data && message.data.template) {
            // Load template elements into editor
            dispatch({ type: 'SET_SELECTED_ELEMENT', payload: null });
            dispatch({ type: 'SET_SELECTED_ELEMENTS', payload: [] });
          }
          break;
        case 'tab:changed':
          // Handle external tab changes
          if (message.data && message.data.tab) {
            dispatch({ type: 'SET_ACTIVE_TAB', payload: message.data.tab });
          }
          break;
        case 'project:selected':
          // Handle project selection from other components
          if (message.data && message.data.project) {
            dispatch({ type: 'SET_CURRENT_PROJECT', payload: message.data.project });
          }
          break;
        case 'client:selected':
          // Handle client selection from other components
          if (message.data && message.data.client) {
            // Log client selection - project type doesn't have client property
            console.log('Client selected:', message.data.client);
          }
          break;
      }
    });

    return unsubscribe;
}, [communication, state.currentProject]);

  const contextValue = {
    state,
    dispatch,
    addElement,
    updateElement,
    deleteElement,
    duplicateElement,
    selectElement,
    selectElements,
    copyElements,
    pasteElements,
    undo,
    redo,
    canUndo,
    canRedo,
    addNotification,
    addToast,
    removeNotification,
    markNotificationRead,
    setActiveTab,
    setSidebarOpen,
    setPropertiesOpen,
    setGridVisible,
    setSnapToGrid,
    setZoom,
    setPan,
    loadProject,
    saveProject,
    createTemplate,
    loadTemplate,
    updateSettings
};

  return (
    <VisualEditorContext.Provider value={contextValue}>
      {children}
    </VisualEditorContext.Provider>
  );
}

// Hook to use the context
export function useVisualEditor() {
  const context = useContext(VisualEditorContext);
  if (!context) {
    throw new Error('useVisualEditor must be used within a VisualEditorProvider');
}
  return context;
}

// Types are already exported via interface declarations above
