/**
 * Universal Dashboard Context Provider
 * Centralized data context for all UniversalDashboard components to communicate
 * Integrates with MasterIntegrationProvider for platform-wide communication
 */

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';

// Types for the universal dashboard context
export interface UniversalProject {
  id: string;
  title?: string;
  name?: string;
  clientName?: string;
  status?: string;
  eventDate?: string;
  date?: string;
  location?: string;
  description?: string;
  type?: 'photography' | 'videography' | 'music' | 'vendor' | 'admin';
  budget?: number;
  timeline?: string;
  deliverables?: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string
}

export interface UniversalClient {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
  status?: 'active' | 'inactive' | 'prospect';
  createdAt?: string;
  updatedAt?: string
}

export interface UniversalEquipment {
  id: string;
  name?: string;
  type?: string;
  status?: 'available' | 'in-use' | 'maintenance' | 'retired';
  location?: string;
  specifications?: Record<string, any>;
  lastMaintenance?: string;
  nextMaintenance?: string;
}

export interface UniversalNotification {
  id: string;
  title?: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  timestamp?: string;
  read?: boolean;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

export interface UniversalSettings {
  proEditorMode?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  timezone?: string;
  notifications?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
};
  privacy?: {
    dataSharing?: boolean;
    analytics?: boolean;
};
}

export interface UniversalTabState {
  main: number;
  settings: number;
  timeline: number;
  projects: number;
  clients: number;
  equipment: number;
  analytics: number
}

export interface UniversalModalState {
  showProjectModal: boolean;
  showQuickNotesModal: boolean;
  showProjectCreation: boolean;
  showVendorProductDialog: boolean;
  showEmailCenter: boolean;
  showEmailDesigner: boolean;
  showChat: boolean;
  showNotifications: boolean;
  showPrototypeFeedback: boolean;
  showCrmDialog: boolean;
  showFAQDialog: boolean;
  showProjectDetailsModal: boolean;
  showEditProjectModal: boolean;
  showDeleteProjectDialog: boolean
}

export interface UniversalState {
  // Core data
  projects: UniversalProject[];
  clients: UniversalClient[];
  equipment: UniversalEquipment[];
  notifications: UniversalNotification[];
  
  // Selected items
  selectedProject: UniversalProject | null;
  selectedClient: UniversalClient | null;
  selectedEquipment: UniversalEquipment | null;
  
  // UI state
  tabState: UniversalTabState;
  modalState: UniversalModalState;
  settings: UniversalSettings;
  
  // Loading states
  loading: {
    projects: boolean;
    clients: boolean;
    equipment: boolean;
    notifications: boolean;
};
  
  // Error states
  errors: {
    projects: string | null;
    clients: string | null;
    equipment: string | null;
    notifications: string | null;
};
  
  // Integration state
  connectedComponents: string[];
  lastSync: number
}

export type UniversalAction =
  | { type: 'SET_PROJECTS'; payload: UniversalProject[] }
  | { type: 'ADD_PROJECT'; payload: UniversalProject }
  | { type: 'UPDATE_PROJECT'; payload: { id: string; updates: Partial<UniversalProject> } }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'SET_CLIENTS'; payload: UniversalClient[] }
  | { type: 'ADD_CLIENT'; payload: UniversalClient }
  | { type: 'UPDATE_CLIENT'; payload: { id: string; updates: Partial<UniversalClient> } }
  | { type: 'DELETE_CLIENT'; payload: string }
  | { type: 'SET_EQUIPMENT'; payload: UniversalEquipment[] }
  | { type: 'ADD_EQUIPMENT'; payload: UniversalEquipment }
  | { type: 'UPDATE_EQUIPMENT'; payload: { id: string; updates: Partial<UniversalEquipment> } }
  | { type: 'DELETE_EQUIPMENT'; payload: string }
  | { type: 'SET_NOTIFICATIONS'; payload: UniversalNotification[] }
  | { type: 'ADD_NOTIFICATION'; payload: UniversalNotification }
  | { type: 'UPDATE_NOTIFICATION'; payload: { id: string; updates: Partial<UniversalNotification> } }
  | { type: 'DELETE_NOTIFICATION'; payload: string }
  | { type: 'SET_SELECTED_PROJECT'; payload: UniversalProject | null }
  | { type: 'SET_SELECTED_CLIENT'; payload: UniversalClient | null }
  | { type: 'SET_SELECTED_EQUIPMENT'; payload: UniversalEquipment | null }
  | { type: 'UPDATE_TAB_STATE'; payload: { key: keyof UniversalTabState; value: number } }
  | { type: 'UPDATE_MODAL_STATE'; payload: { key: keyof UniversalModalState; value: boolean } }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UniversalSettings> }
  | { type: 'SET_LOADING'; payload: { key: keyof UniversalState['loading']; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: keyof UniversalState['errors']; value: string | null } }
  | { type: 'ADD_CONNECTED_COMPONENT'; payload: string }
  | { type: 'REMOVE_CONNECTED_COMPONENT'; payload: string }
  | { type: 'UPDATE_LAST_SYNC'; payload: number };

const initialUniversalState: UniversalState = {
  projects: [],
  clients: [],
  equipment: [],
  notifications: [],
  selectedProject: null,
  selectedClient: null,
  selectedEquipment: null,
  tabState: {
    main: 0,
    settings: 0,
    timeline: 0,
    projects: 0,
    clients: 0,
    equipment: 0,
    analytics: 0
  },
  modalState: {
    showProjectModal: false,
    showQuickNotesModal: false,
    showProjectCreation: false,
    showVendorProductDialog: false,
    showEmailCenter: false,
    showEmailDesigner: false,
    showChat: false,
    showNotifications: false,
    showPrototypeFeedback: false,
    showCrmDialog: false,
    showFAQDialog: false,
    showProjectDetailsModal: false,
    showEditProjectModal: false,
    showDeleteProjectDialog: false
},
  settings: {
    proEditorMode: false,
    theme: 'light',
    language: 'en',
    timezone: 'UT',
    notifications: {
      email: true,
      push: true,
      sms: false
},
    privacy: {
      dataSharing: false,
      analytics: true
}
},
  loading: {
    projects: false,
    clients: false,
    equipment: false,
    notifications: false
},
  errors: {
    projects: null,
    clients: null,
    equipment: null,
    notifications: null
},
  connectedComponents:  [],
  lastSync: Date.now(), 
};

function universalReducer(state: UniversalState, action: UniversalAction): UniversalState {
  switch (action.type) {
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(project =>
          project.id === action.payload.id
            ? { ...project, ...action.payload.updates }
            : project
        )
      };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(project => project.id !== action.payload)
      };
    case 'SET_CLIENTS':
      return { ...state, clients: action.payload };
    case 'ADD_CLIENT':
      return { ...state, clients: [...state.clients, action.payload] };
    case 'UPDATE_CLIENT':
      return {
        ...state,
        clients: state.clients.map(client =>
          client.id === action.payload.id
            ? { ...client, ...action.payload.updates }
            : client
        )
      };
    case 'DELETE_CLIENT':
      return {
        ...state,
        clients: state.clients.filter(client => client.id !== action.payload)
      };
    case 'SET_EQUIPMENT':
      return { ...state, equipment: action.payload };
    case 'ADD_EQUIPMENT':
      return { ...state, equipment: [...state.equipment, action.payload] };
    case 'UPDATE_EQUIPMENT':
      return {
        ...state,
        equipment: state.equipment.map(item =>
          item.id === action.payload.id
            ? { ...item, ...action.payload.updates }
            : item
        )
      };
    case 'DELETE_EQUIPMENT':
      return {
        ...state,
        equipment: state.equipment.filter(item => item.id !== action.payload)
      };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] };
    case 'UPDATE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload.id
            ? { ...notification, ...action.payload.updates }
            : notification
        )
      };
    case 'DELETE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(notification => notification.id !== action.payload)
      };
    case 'SET_SELECTED_PROJECT':
      return { ...state, selectedProject: action.payload };
    case 'SET_SELECTED_CLIENT':
      return { ...state, selectedClient: action.payload };
    case 'SET_SELECTED_EQUIPMENT':
      return { ...state, selectedEquipment: action.payload };
    case 'UPDATE_TAB_STATE':
      return {
        ...state,
        tabState: { ...state.tabState, [action.payload.key]: action.payload.value }
      };
    case 'UPDATE_MODAL_STATE':
      return {
        ...state,
        modalState: { ...state.modalState, [action.payload.key]: action.payload.value }
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
    case 'ADD_CONNECTED_COMPONENT':
      return {
        ...state,
        connectedComponents: [...state.connectedComponents, action.payload]
      };
    case 'REMOVE_CONNECTED_COMPONENT':
      return {
        ...state,
        connectedComponents: state.connectedComponents.filter(id => id !== action.payload)
      };
    case 'UPDATE_LAST_SYNC':
      return { ...state, lastSync: action.payload };
    default:
      return state;
  }
}

interface UniversalContextValue {
  state: UniversalState;
  // Project actions
  setProjects: (projects: UniversalProject[]) => void;
  addProject: (project: UniversalProject) => void;
  updateProject: (id: string, updates: Partial<UniversalProject>) => void;
  deleteProject: (id: string) => void;
  setSelectedProject: (project: UniversalProject | null) => void;
  // Client actions
  setClients: (clients: UniversalClient[]) => void;
  addClient: (client: UniversalClient) => void;
  updateClient: (id: string, updates: Partial<UniversalClient>) => void;
  deleteClient: (id: string) => void;
  setSelectedClient: (client: UniversalClient | null) => void;
  // Equipment actions
  setEquipment: (equipment: UniversalEquipment[]) => void;
  addEquipment: (item: UniversalEquipment) => void;
  updateEquipment: (id: string, updates: Partial<UniversalEquipment>) => void;
  deleteEquipment: (id: string) => void;
  setSelectedEquipment: (item: UniversalEquipment | null) => void;
  // Notification actions
  setNotifications: (notifications: UniversalNotification[]) => void;
  addNotification: (notification: Omit<UniversalNotification, 'id' | 'timestamp'>) => void;
  updateNotification: (id: string, updates: Partial<UniversalNotification>) => void;
  deleteNotification: (id: string) => void;
  // UI actions
  updateTabState: (key: keyof UniversalTabState, value: number) => void;
  updateModalState: (key: keyof UniversalModalState, value: boolean) => void;
  updateSettings: (settings: Partial<UniversalSettings>) => void;
  // Loading and error actions
  setLoading: (key: keyof UniversalState['loading'], value: boolean) => void;
  setError: (key: keyof UniversalState['errors'], value: string | null) => void;
  // Integration actions
  broadcastChange: (type: string, data: any) => void;
  requestData: (componentId: string, dataKey: string) => Promise<any>;
  syncWithComponent: (componentId: string, dataKey: string, data: any) => void;
}

const UniversalContext = createContext<UniversalContextValue | undefined>(undefined);

export const useUniversalDashboard = () => {
  const context = useContext(UniversalContext);
  if (!context) {
    throw new Error('useUniversalDashboard must be used within a UniversalDashboardProvider , ');
}
  return context;
};

export const UniversalDashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(universalReducer, initialUniversalState);
  const { integration, communication, dataFlow } = useEnhancedMasterIntegration();
  const lastSyncRef = useRef<number>(Date.now());

  // Generate unique IDs
  const generateId = useCallback(() => {
    return `universal-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  // Project actions
  const setProjects = useCallback((projects: UniversalProject[]) => {
    dispatch({ type: 'SET_PROJECTS,', payload: projects });
    broadcastChange('projects:updated', projects);
  }, []);

  const addProject = useCallback((project: UniversalProject) => {
    const newProject = { ...project, id: project.id || generateId() };
    dispatch({ type: 'ADD_PROJECT', payload: newProject });
    broadcastChange('project:added', newProject);
  }, [generateId]);

  const updateProject = useCallback((id: string, updates: Partial<UniversalProject>) => {
    dispatch({ type: 'UPDATE_PROJECT', payload: { id, updates } });
    broadcastChange('project:updated', { id, updates });
  }, []);

  const deleteProject = useCallback((id: string) => {
    dispatch({ type: 'DELETE_PROJECT', payload: id });
    broadcastChange('project:deleted', { id });
  }, []);

  const setSelectedProject = useCallback((project: UniversalProject | null) => {
    dispatch({ type: 'SET_SELECTED_PROJECT', payload: project });
    broadcastChange('project:selected', project);
  }, []);

  // Client actions
  const setClients = useCallback((clients: UniversalClient[]) => {
    dispatch({ type: 'SET_CLIENTS', payload: clients });
    broadcastChange('clients:updated', clients);
  }, []);

  const addClient = useCallback((client: UniversalClient) => {
    const newClient = { ...client, id: client.id || generateId() };
    dispatch({ type: 'ADD_CLIENT', payload: newClient });
    broadcastChange('client:added', newClient);
  }, [generateId]);

  const updateClient = useCallback((id: string, updates: Partial<UniversalClient>) => {
    dispatch({ type: 'UPDATE_CLIENT', payload: { id, updates } });
    broadcastChange('client:updated', { id, updates });
  }, []);

  const deleteClient = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CLIENT', payload: id });
    broadcastChange('client:deleted', { id });
  }, []);

  const setSelectedClient = useCallback((client: UniversalClient | null) => {
    dispatch({ type: 'SET_SELECTED_CLIENT', payload: client });
    broadcastChange('client:selected', client);
  }, []);

  // Equipment actions
  const setEquipment = useCallback((equipment: UniversalEquipment[]) => {
    dispatch({ type: 'SET_EQUIPMENT', payload: equipment });
    broadcastChange('equipment:updated', equipment);
  }, []);

  const addEquipment = useCallback((item: UniversalEquipment) => {
    const newItem = { ...item, id: item.id || generateId() };
    dispatch({ type: 'ADD_EQUIPMENT', payload: newItem });
    broadcastChange('equipment:added', newItem);
  }, [generateId]);

  const updateEquipment = useCallback((id: string, updates: Partial<UniversalEquipment>) => {
    dispatch({ type: 'UPDATE_EQUIPMENT', payload: { id, updates } });
    broadcastChange('equipment:updated', { id, updates });
  }, []);

  const deleteEquipment = useCallback((id: string) => {
    dispatch({ type: 'DELETE_EQUIPMENT', payload: id });
    broadcastChange('equipment:deleted', { id });
  }, []);

  const setSelectedEquipment = useCallback((item: UniversalEquipment | null) => {
    dispatch({ type: 'SET_SELECTED_EQUIPMENT', payload: item });
    broadcastChange('equipment:selected', item);
  }, []);

  // Notification actions
  const setNotifications = useCallback((notifications: UniversalNotification[]) => {
    dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications });
    broadcastChange('notifications:updated', notifications);
  }, []);

  const addNotification = useCallback((notification: Omit<UniversalNotification, 'id' | 'timestamp'>) => {
    const newNotification: UniversalNotification = {
      ...notification,
      id: generateId(),
      timestamp: new Date().toISOString(),
      read: false
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });
    broadcastChange('notification:added', newNotification);
  }, [generateId]);

  const updateNotification = useCallback((id: string, updates: Partial<UniversalNotification>) => {
    dispatch({ type: 'UPDATE_NOTIFICATION', payload: { id, updates } });
    broadcastChange('notification:updated', { id, updates });
  }, []);

  const deleteNotification = useCallback((id: string) => {
    dispatch({ type: 'DELETE_NOTIFICATION', payload: id });
    broadcastChange('notification:deleted', { id });
  }, []);

  // UI actions
  const updateTabState = useCallback((key: keyof UniversalTabState, value: number) => {
    dispatch({ type: 'UPDATE_TAB_STATE', payload: { key, value } });
    broadcastChange('tab:changed', { key, value });
  }, []);

  const updateModalState = useCallback((key: keyof UniversalModalState, value: boolean) => {
    dispatch({ type: 'UPDATE_MODAL_STATE', payload: { key, value } });
    broadcastChange('modal:changed', { key, value });
  }, []);

  const updateSettings = useCallback((settings: Partial<UniversalSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    broadcastChange('settings:updated', settings);
  }, []);

  // Loading and error actions
  const setLoading = useCallback((key: keyof UniversalState['loading'], value: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: { key, value } });
  }, []);

  const setError = useCallback((key: keyof UniversalState['errors'], value: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: { key, value } });
  }, []);

  // Integration actions
  const broadcastChange = useCallback((type: string, data: any) => {
    communication.sendMessage({
      from: 'universal-dashboard',
      to: 'all',
      type,
      data,
      priority: 'medium'
    });

    // Also emit through integration system
    integration.emit(type, data);
  }, [communication, integration]);

  const requestData = useCallback(async (componentId: string, dataKey: string): Promise<any> => {
    return new Promise((resolve) => {
      const requestId = generateId();
      const timeout = setTimeout(() => {
        resolve(null);
      }, 5000);

      const unsubscribe = communication.onMessage((message: any) => {
        if (message.type === `${dataKey}:response` && message.requestId === requestId) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(message.data);
        }
      });

      communication.sendMessage({
        from: 'universal-dashboard',
        to: componentId,
        type: `${dataKey}:request`,
        data: { requestId, dataKey },
        priority: 'medium'
      });
    });
  }, [communication, generateId]);

  const syncWithComponent = useCallback((componentId: string, dataKey: string, data: any) => {
    dataFlow.syncData(`${componentId}:${dataKey}`, data);
  }, [dataFlow]);

  // Register with integration system
  useEffect(() => {
    communication.registerComponent('universal-dashboard','dashboard', [
      'data:read','data:write','event:emit','event:listen','ui:update','project:manage','client:manage','equipment:manage', 'notification:manage', 'settings:manage'
    ]);

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-dashboard',
      dataKey: 'universal-dashboard:projects',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-dashboard',
      dataKey: 'universal-dashboard:clients',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-dashboard',
      dataKey: 'universal-dashboard:selectedProject',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-dashboard',
      dataKey: 'universal-dashboard:selectedClient',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
    });

    return () => {
      communication.unregisterComponent('universal-dashboard');
    };
  }, [communication, dataFlow]);

  // Listen for external changes
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      switch (message.type) {
        case 'project:selected':
          if (message.data) {
            setSelectedProject(message.data);
          }
          break;
        case 'client:selected':
          if (message.data) {
            setSelectedClient(message.data);
          }
          break;
        case 'project:added':
          if (message.data) {
            addProject(message.data);
          }
          break;
        case 'client:added':
          if (message.data) {
            addClient(message.data);
          }
          break;
        case 'notification:added':
          if (message.data) {
            addNotification(message.data);
          }
          break;
        case 'data:sync':
          if (message.data.dataKey === 'universal-dashboard:projects') {
            setProjects(message.data.data);
          } else if (message.data.dataKey === 'universal-dashboard:clients') {
            setClients(message.data.data);
          }
          break;
      }
    });

    return unsubscribe;
  }, [communication, setSelectedProject, setSelectedClient, addProject, addClient, addNotification, setProjects, setClients]);

  // Auto-sync with external data
  useEffect(() => {
    const interval = setInterval(() => {
      lastSyncRef.current = Date.now();
      dispatch({ type: 'UPDATE_LAST_SYNC', payload: lastSyncRef.current });
    }, 30000); // Sync every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const contextValue: UniversalContextValue = {
    state,
    setProjects,
    addProject,
    updateProject,
    deleteProject,
    setSelectedProject,
    setClients,
    addClient,
    updateClient,
    deleteClient,
    setSelectedClient,
    setEquipment,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    setSelectedEquipment,
    setNotifications,
    addNotification,
    updateNotification,
    deleteNotification,
    updateTabState,
    updateModalState,
    updateSettings,
    setLoading,
    setError,
    broadcastChange,
    requestData,
    syncWithComponent
};

  return (
    <UniversalContext.Provider value={contextValue}>
      {children}
    </UniversalContext.Provider>
  );
};


