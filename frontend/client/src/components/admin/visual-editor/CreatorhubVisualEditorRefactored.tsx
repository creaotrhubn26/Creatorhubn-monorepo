/**
 * CreatorHub Visual Editor - Refactored Main Component
 * Uses smaller, focused components for better maintainability
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Tabs, Tab, Typography } from '@mui/material';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useTheming } from '../../../utils/theming-helper';
import { useCreatorHubBranding } from '../../../hooks/useCreatorHubBranding';
import { themingAdminService } from '../../../services/ThemingAdminService';
import { VisualEditorProvider, useVisualEditor } from './VisualEditorContext';
import { useDatabase } from '../../../hooks/useDatabase';
import DatabaseIntegrationService from '../../../services/DatabaseIntegrationService';
// import { useAuth } from '@/hooks/useAuth';

// Import smaller components
import VisualEditorToolbar from './VisualEditorToolbar';
import VisualEditorCanvas from './VisualEditorCanvas';
import VisualEditorSidebar from './VisualEditorSidebar';
import VisualEditorProperties from './VisualEditorProperties';

// Import all new dashboard components for unified workflow
import TemplateDashboard from './TemplateDashboard';
import ExportPresetsDashboard from './ExportPresetsDashboard';
import CloudSyncDashboard from './CloudSyncDashboard';
import TeamCollaborationDashboard from './TeamCollaborationDashboard';
import PluginDashboard from './PluginDashboard';
import AnimationDashboard from './AnimationDashboard';
import ComponentLibraryDashboard from './ComponentLibraryDashboard';
import DesignSystemDashboard from './DesignSystemDashboard';
import AnalyticsDashboard from './AnalyticsDashboard';
import AuditDashboard from './AuditDashboard';
import MonitoringDashboard from './MonitoringDashboard';
import SystemManagementDashboard from './SystemManagementDashboard';
import MLOptimizationDashboard from './MLOptimizationDashboard';
import AdvancedAnalyticsDashboard from './AdvancedAnalyticsDashboard';
import AIAssistanceDashboard from './AIAssistanceDashboard';
import TemplatePresetDashboard from './TemplatePresetDashboard';
import ClientCommunicationDashboard from './ClientCommunicationDashboard';
import RevenueOptimizationDashboard from './RevenueOptimizationDashboard';
import SEODashboard from './SEODashboard';
import BrandingWorkflowPanel from './BrandingWorkflowPanel';
import { LogoManagementPanel } from './LogoManagementPanel';
import ThemingAdminPanel from './ThemingAdminPanel';
import LandingSettingsPanel from './LandingSettingsPanel';
import ShowcasePublisherPanel from '../../showcase/ShowcasePublisherPanel';
// Import custom hooks (to be created)
// import { useVisualEditor } from '../hooks/useVisualEditor';
// import { useScrollStories } from '../hooks/useScrollStories';
// import { useAssetLibrary } from '../hooks/useAssetLibrary';

// Types
interface EditorElement {
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
  props: Record<string, unknown>;
  children?: string[];
  parent?: string;
  icon?: string;
}

interface EditorProject {
  id: string;
  name: string;
  elements: Record<string, EditorElement>;
  pageSettings: {
    width: number;
    height: number;
    backgroundColor: string;
};
}

interface IntegrationMessage {
  type: string;
  from?: string;
  data: Record<string, unknown>;
}

interface ProjectVersion {
  id: string;
  timestamp: number;
  project: EditorProject;
}

interface Collaborator {
  id: string;
  name: string;
  role: string;
}

interface CursorInfo {
  x: number;
  y: number;
  timestamp: number;
}

interface CreatorhubVisualEditorProps {
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: Record<string, unknown>) => void;
  onProjectUpdate?: (project: EditorProject) => void;
  onWorklogCreate?: (worklog: Record<string, unknown>) => void;
  onClientSelect?: (client: Record<string, unknown>) => void;
  onClientUpdate?: (client: Record<string, unknown>) => void;
  onShowcaseCreate?: (showcase: Record<string, unknown>) => void;
  onFileUpload?: (file: File | Record<string, unknown>) => void;
  onFileDownload?: (file: Record<string, unknown>) => void;
  selectedProject?: EditorProject;
  onProjectSelect?: (project: EditorProject) => void;
  selectedClient?: Record<string, unknown>;
  onSettingsUpdate?: (settings: Record<string, unknown>) => void;
  onNotificationCreate?: (notification: Record<string, unknown>) => void;
}

// Main component that uses the context
const CreatorhubVisualEditorContent: React.FC<CreatorhubVisualEditorProps> = ({
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}) => {
  // const { user } = useAuth();
  const user = { id: 'demo-user', name: 'Demo User' };
  
  // Master integration system for "everything in the system interacts with everything"
  const { integration, communication, dataFlow } = useEnhancedMasterIntegration();
  
  // Theming system (Optional) if you want to add a theme. If you don't want to add a theme, you can leave it blank. If you want to add a description, you can add it here. If you don't want to add a description, you can leave it blank.
  const theming = useTheming('prototype_tester');
  
  // CreatorHub Branding system (Optional) if you want to add a branding. If you don't want to add a branding, you can leave it blank. If you want to add a description, you can add it here. If you don't want to add a description, you can leave it blank.
  const [brandingProfession, setBrandingProfession] = useState<'admin' | 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'>('photographer');
  const [brandingCategory, setBrandingCategory] = useState<string | undefined>(undefined);
  const [customBrandColor, setCustomBrandColor] = useState<string | undefined>(undefined);
  const branding = useCreatorHubBranding({
    profession: brandingProfession,
    projectCategory: brandingCategory,
    customColor: customBrandColor,
    validate: true
});
  
  // Database integration (Optional) if you want to add a database. If you don't want to add a database, you can leave it blank. If you want to add a description, you can add it here. If you don't want to add a description, you can leave it blank.
  const databaseHook = useDatabase();
  const { 
    isConnected: dbConnected = false, 
    error: dbError = null, 
    saveProject: saveProjectToDb = async () => {}, 
    loadProject: loadProjectFromDb = async () => null, 
    autoSaveProject = async () => {}, 
    syncProjectChanges = async () => {}, 
    trackProjectUsage = async () => {}, 
    saveAsTemplate = async () => {}, 
    getUserProjects = async () => [], 
    searchProjects = async () => [], 
    deleteProject = async () => {} 
} = (databaseHook || {}) as Record<string, (...args: unknown[]) => unknown>;
  
  // Core state (moved to top to avoid hoisting issues) (Optional) if you want to add a project. If you don't want to add a project, you can leave it blank. If you want to add a description, you can add it here. If you don't want to add a description, you can leave it blank.
  const [project, setProject] = useState<EditorProject>({
    id: 'default-project, ',
    name: 'New Project',
    elements: {},
    pageSettings: {
      width: 1200,
      height: 800,
      backgroundColor: '#ffffff'
}
});

  // Database integration state (Optional) if you want to add a database integration. If you don't want to add a database integration, you can leave it blank. If you want to add a description, you can add it here. If you don't want to add a description, you can leave it blank.
  const [dbIntegration, setDbIntegration] = useState<DatabaseIntegrationService | null>(null);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [realTimeCursors, setRealTimeCursors] = useState<Record<string, CursorInfo>>({});

  // Visual editor context
  const visualEditorHook = useVisualEditor();
  const {
    addNotification = () => {},
} = (visualEditorHook || {}) as Record<string, (...args: unknown[]) => void>;

  // Initialize database integration
  useEffect(() => {
    if (dbConnected && !dbIntegration) {
      // Get database instance from the integration system
      const dbInstance = integration?.getDatabase?.() || null;
      if (dbInstance) {
        setDbIntegration(new DatabaseIntegrationService(dbInstance, communication, integration, dataFlow));
    }
  }
}, [dbConnected, integration, communication, dataFlow]);

  // Register this component in the integration system
  useEffect(() => {
    communication.registerComponent('visual-editor', 'visual-editor', [
      'data:read','data:write','event:emit','event:listen','action:execute','ui:update','collaboration:update'
    ]);

    // Set up data flow nodes
    dataFlow.registerNode('source', 'visual-editor', 'visual-editor:project', (data: Record<string, unknown>) => ({ ...data, lastUpdated: Date.now() }));
    dataFlow.registerNode('destination', 'visual-editor', 'visual-editor:selectedElement', (data: Record<string, unknown>) => data);

    return () => {
      communication.unregisterComponent('visual-editor');
  };
}, [communication, dataFlow]);

  // Auto-save functionality
  useEffect(() => {
    if (!dbConnected) return;

    const autoSaveInterval = setInterval(async () => {
      try {
        if (project && Object.keys(project.elements).length > 0) {
          await autoSaveProject(project.id, 'visual-editor:project', project);
          setLastAutoSave(new Date());
        }
      } catch (error) {
        console.error('❌ Auto-save failed: ', error);
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [dbConnected, project, autoSaveProject]);

  // Real-time collaboration listeners
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: IntegrationMessage) => {
      if (message.type === 'visual-editor:project:synced' && 
          (message.data as Record<string, unknown>).projectId === project?.id) {
        // Apply remote changes
        setProject((prev: EditorProject) => ({
          ...prev,
          elements: { ...prev.elements, ...((message.data as Record<string, Record<string, EditorElement>>).changes?.elements || {}) }
      }));
    }
      
      if (message.type === 'visual-editor:cursor:update') {
        setRealTimeCursors((prev: Record<string, CursorInfo>) => ({
          ...prev,
          [message.data.userId]: {
            ...message.data.cursor,
            timestamp: message.data.timestamp || Date.now()
        }
      }));
    }
  });

    return unsubscribe;
}, [communication, project?.id]);

  // Listen to global events and update accordingly
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: IntegrationMessage) => {
      if (message.type === 'project:selected' && message.data) {
        setProject(message.data as unknown as EditorProject);
  }
      if (message.type === 'client:selected' && message.data) {
        onClientSelect?.(message.data as Record<string, unknown>);
  }
      if (message.type === 'data: sync' && message.data.dataKey === 'visual-editor:project') {
        setProject(message.data.data as EditorProject);
  }
      
      // Listen for new components from CodeGenerationStudio
      if (message.type === 'new-components-available' && message.data) {
        addNotification('visual-editor', 'new-components-available', {
          title: 'New components available',
          message: `${message.data.components?.length || 0} new components generated for ${message.data.provider}`,
          type: 'success',
          read: false
        });
        document.dispatchEvent(new CustomEvent('visual-editor:refresh-component-library', {
          detail: { components: message.data.components, provider: message.data.provider }
        }));
      }

      // Listen for code generation completion
      if (message.type === 'code-generation:complete' && message.data) {
        addNotification('visual-editor', 'code-generation:complete', {
          title: 'Code generation complete',
          message: `${message.data.provider} integration ready to use!`,
          type: 'success',
          read: false
        });
    }
  });

    return unsubscribe;
}, [communication, onClientSelect, addNotification]);

  const [selectedView, setSelectedView] = useState<string>('designer');
  const [showUnifiedDashboard, setShowUnifiedDashboard] = useState(false);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedElement, setSelectedElement] = useState<EditorElement | null>(null);

  // Visual editor state
  const [extendedThinking, setExtendedThinking] = useState(false);
  const [highPowerMode, setHighPowerMode] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [gridSize, setGridSize] = useState(20);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0, r: 0 });
  const [showRulers, setShowRulers] = useState(true);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);

  // Dialog state
  const [scrollStoriesOpen, setScrollStoriesOpen] = useState(false);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [qualityAnalysisOpen, setQualityAnalysisOpen] = useState(false);
  const [googleServicesOpen, setGoogleServicesOpen] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [seoDashboardOpen, setSeoDashboardOpen] = useState(false);
  const [brandingPanelOpen, setBrandingPanelOpen] = useState(false);
  const [logoManagementOpen, setLogoManagementOpen] = useState(false);

  // History state
  const [history, setHistory] = useState<EditorProject[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'buttons' | 'text' | 'images' | 'cards' | 'containers' | 'grids' | 'audio' | 'video'>('all');

  // Clipboard state
  const [clipboard, setClipboard] = useState<EditorElement | null>(null);

  // Loading state
  const [isSaving, setIsSaving] = useState(false);
  

  // Database sync handler (defined early to avoid hoisting issues)
  const handleSyncProjectChanges = useCallback(async (changes: Record<string, unknown>) => {
    try {
      if (dbConnected && dbIntegration) {
        await dbIntegration.syncProjectChanges(project?.id || "", changes || {}, 'visual-editor', 'all');
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
    }
  }, [dbConnected, dbIntegration, project?.id]);

  // Event handlers
  const handleViewChange = useCallback((view: string) => {
    setSelectedView(view);
  }, []);

  const handleElementSelect = useCallback((elementId: string) => {
    if (elementId) {
      setSelectedElements([elementId]);
      const element = project.elements[elementId] || null;
      setSelectedElement(element as EditorElement | null);

      // Broadcast to CodeGenerationStudio for API suggestions
      if (element) {
        communication.sendBroadcast('visual-editor:component:selected', 'visual-editor', 'visual-editor:component:selected', {
          type: element.type,
          id: element.id,
          props: element.props
        });
      }
    } else {
      setSelectedElements([]);
      setSelectedElement(null);
    }
  }, [project.elements, communication]);

  const handleElementUpdate = useCallback((elementId: string, updates: Partial<EditorElement>) => {
    setProject(prev => {
      const updatedProject = {
        ...prev,
        elements: {
          ...prev.elements,
          [elementId]: {
            ...prev.elements[elementId],
            ...updates
          }
        }
      };

      // Track element update in database
      if (dbConnected) {
        trackProjectUsage(project.id, 'element_updated', {
          elementId,
          elementType: updates.type || prev.elements[elementId]?.type,
          updateType: Object.keys(updates).join(', '),
          coordinates: updates.x !== undefined || updates.y !== undefined ?
            { x: updates.x || prev.elements[elementId]?.x, y: updates.y || prev.elements[elementId]?.y } : undefined
        }).catch(console.error);
      }
      
      // Broadcast update to all components
      integration.emit('visual-editor:element:updated', {
        elementId,
        updates,
        project: updatedProject
    });
      
      communication.sendBroadcast('data:update', {
        type: 'element:updated',
        elementId,
        updates,
        project: updatedProject
      });

      // Sync data across all components
      dataFlow.syncData('visual-editor:project', updatedProject, 'visual-editor', 'all');

      // Sync changes to database for real-time collaboration
      if (dbConnected) {
        handleSyncProjectChanges({ elements: updatedProject.elements });
      }

      return updatedProject;
    });
  }, [integration, communication, dataFlow, dbConnected, project.id, trackProjectUsage, handleSyncProjectChanges]);

  const handleElementDelete = useCallback((elementId: string) => {
    setProject(prev => {
      const newElements = { ...prev.elements };
      delete newElements[elementId];
      const updatedProject = {
        ...prev,
        elements: newElements
      };

      // Broadcast deletion to all components
      integration.emit('visual-editor:element:deleted', {
        elementId,
        project: updatedProject
      });

      communication.sendBroadcast('data:update', {
        type: 'element:deleted',
        elementId,
        project: updatedProject
      });

      // Sync data across all components
      dataFlow.syncData('visual-editor:project', updatedProject, 'visual-editor', 'all');

      return updatedProject;
    });
    setSelectedElements([]);
    setSelectedElement(null);
  }, [integration, communication, dataFlow]);

  const handleElementAdd = useCallback((componentType: string, position: { x: number; y: number }) => {
    const validType = (componentType || 'button') as 'button' | 'text' | 'image' | 'card' | 'container' | 'grid' | 'audio' | 'video';
    const newElement: EditorElement = {
      id: `element_${Date.now()}`,
      type: validType,
      x: position.x,
      y: position.y,
      width: 100,
      height: 40,
      styles: {},
      props: {}
    };

    setProject(prev => {
      const updatedProject = {
        ...prev,
        elements: {
          ...prev.elements,
          [newElement.id]: newElement
        }
      };

      // Broadcast addition to all components
      integration.emit('visual-editor:element:added', {
        element: newElement,
        project: updatedProject
      });

      communication.sendBroadcast('data:update', {
        type: 'element:added',
        element: newElement,
        project: updatedProject
      });

      // Sync data across all components
      dataFlow.syncData('visual-editor:project', updatedProject, 'visual-editor', 'all');

      return updatedProject;
    });

    handleElementSelect(newElement.id);
}, [handleElementSelect, integration, communication, dataFlow]);

  const handleComponentDrag = useCallback((componentType: string) => {
    setIsDragging(true);
    setDraggedComponent(componentType);
}, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedComponent(null);
}, []);

  const handleCanvasDrop = useCallback((position: { x: number; y: number }) => {
    if (draggedComponent) {
      handleElementAdd(draggedComponent, position);
  }
}, [draggedComponent, handleElementAdd]);

  // Toolbar handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setProject(history[historyIndex - 1]);
  }
}, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setProject(history[historyIndex + 1]);
  }
}, [historyIndex, history]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Save to database if connected
      if (dbConnected) {
        await saveProjectToDb(project);

        // Track save action
        await trackProjectUsage(project.id, 'project_saved', {
          elementCount: Object.keys(project.elements).length,
          projectSize: JSON.stringify(project).length
        });
      }

      // Update local state
      setProject(prev => ({ ...prev, lastSaved: new Date() }));
      onProjectUpdate?.(project);

      // Broadcast save to all components
      integration.emit('visual-editor:project:saved', { project });
      communication.sendBroadcast('data:update', {
        type: 'project:saved',
        project
      });
      dataFlow.syncData('visual-editor:project', project, 'visual-editor', 'all');

      // Show success notification
      addNotification({
        title: 'Project Saved',
        message: 'Project saved successfully!',
        type: 'success',
        read: false
      });
    } catch (error) {
      console.error('Save failed:', error);
      addNotification({
        title: 'Save Failed',
        message: 'Save, failed: ' + (error as Error).message,
        type: 'error',
        read: false
      });
    } finally {
      setIsSaving(false);
    }
}, [project, onProjectUpdate, integration, communication, dataFlow, dbConnected, saveProjectToDb, trackProjectUsage, addNotification]);

  // Universal function to update any component from the visual editor
  const updateAnyComponent = useCallback((targetComponent: string, action: string, data: Record<string, unknown>) => {
    // Method 1: Direct communication
    communication.sendMessage({
      from: 'visual-editor',
      to: targetComponent,
      type: action,
      data,
      priority: 'high'
    });

    // Method 2: Integration events
    integration.emit(`${targetComponent}:${action}`, data, 'visual-editor', 'all');

    // Method 3: Data flow
    dataFlow.syncData(`${targetComponent}:${action}`, data, 'visual-editor', 'all');

    // Method 4: Execute action
    integration.executeAction(action, { target: targetComponent, data }, 'high', 'visual-editor', 'all');
  }, [communication, integration, dataFlow]);

  // Universal function to get data from any component
  const getDataFromComponent = useCallback(async (targetComponent: string, dataKey: string) => {
    // Method 1: Request data via communication
    return new Promise((resolve) => {
      const unsubscribe = communication.onMessage((message: IntegrationMessage) => {
        if (message.from === targetComponent && message.type === `${dataKey}:response`) {
          unsubscribe();
          resolve(message.data);
        }
      });

      communication.sendMessage({
        from: 'visual-editor',
        to: targetComponent,
        type: `${dataKey}:request`,
        data: { requestId: Date.now() },
        priority: 'medium'
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 5000);
    });
  }, [communication]);

  // Universal function to trigger actions in any component
  const triggerComponentAction = useCallback((targetComponent: string, action: string, ...args: unknown[]) => {
    // Method 1: Direct action execution
    integration.executeAction(action, { target: targetComponent, args }, 'high', 'visual-editor', 'all');

    // Method 2: Communication message
    communication.sendMessage({
      from: 'visual-editor',
      to: targetComponent,
      type: `action:${action}`,
      data: { args },
      priority: 'high'
    });

    // Method 3: Integration event
    integration.emit(`${targetComponent}:action:${action}`, { args }, 'visual-editor', 'all');
  }, [integration, communication]);

  // Dialog handlers
  const handleOpenScrollStories = useCallback(() => {
    setScrollStoriesOpen(true);
}, []);

  const handleOpenAssetLibrary = useCallback(() => {
    setAssetLibraryOpen(true);
}, []);

  const handleOpenQualityAnalysis = useCallback(() => {
    setQualityAnalysisOpen(true);
}, []);

  const handleOpenGoogleServices = useCallback(() => {
    setGoogleServicesOpen(true);
}, []);

  const handleOpenNoteEditor = useCallback(() => {
    setNoteEditorOpen(true);
}, []);

  const handleOpenSEODashboard = useCallback(() => {
    setSeoDashboardOpen(true);
}, []);

  // Database-related handlers
  const handleLoadProject = useCallback(async (projectId: string) => {
    try {
      if (dbConnected) {
        const loadedProject = await loadProjectFromDb(projectId);
        if (loadedProject) {
          setProject(loadedProject);
          addNotification({
            title: 'Project Loaded',
            message: 'Project loaded successfully!',
            type: 'success',
            read: false
          });

          // Track load action
          await trackProjectUsage(projectId, 'project_loaded', {
            projectId,
            elementCount: Object.keys(loadedProject.elements).length
          });
        } else {
          addNotification({
            title: 'Project Not Found',
            message: 'Project not found',
            type: 'error',
            read: false
          });
        }
      }
    } catch (error) {
      console.error('Load failed:', error);
      addNotification({
        title: 'Load Failed',
        message: 'Load, failed: ' + (error as Error).message,
        type: 'error',
        read: false
      });
    }
  }, [dbConnected, loadProjectFromDb, trackProjectUsage, addNotification]);

  const handleSaveAsTemplate = useCallback(async (templateName: string) => {
    try {
      if (dbConnected) {
        await saveAsTemplate(project, templateName);
        addNotification({
          title: 'Template Saved',
          message: 'Template saved successfully!',
          type: 'success',
          read: false
        });

        // Track template creation
        await trackProjectUsage(project.id, 'template_created', { projectId: project.id, templateName });
      }
    } catch (error) {
      console.error('Template save failed:', error);
      addNotification({
        title: 'Template Save Failed',
        message: 'Template save, failed: ' + (error as Error).message,
        type: 'error',
        read: false
      });
    }
  }, [dbConnected, project, saveAsTemplate, trackProjectUsage, addNotification]);

  const handleBroadcastCursorPosition = useCallback((position: { x: number; y: number }) => {
    communication.sendBroadcast('visual-editor:cursor:update', { userId: user.id, cursor: position, timestamp: Date.now() }, 'visual-editor', 'all');
  }, [communication, user.id]);

  // Computed values
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const totalElementsCount = Object.keys(project.elements).length;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <VisualEditorToolbar
        selectedView={selectedView}
        onViewChange={handleViewChange}
        extendedThinking={extendedThinking}
        onExtendedThinkingChange={setExtendedThinking}
        highPowerMode={highPowerMode}
        onHighPowerModeChange={setHighPowerMode}
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        snapToGrid={snapToGrid}
        onSnapToGridChange={setSnapToGrid}
        multiSelectMode={multiSelectMode}
        onMultiSelectModeChange={setMultiSelectMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSave}
        onCopy={() => {
          if (selectedElement) {
            setClipboard(selectedElement);
          }
        }}
        onPaste={() => {
          if (clipboard) {
            const pastedElement: EditorElement = {
              ...clipboard,
              id: `element_${Date.now()}`,
              x: clipboard.x + 20,
              y: clipboard.y + 20,
            };
            setProject(prev => ({
              ...prev,
              elements: { ...prev.elements, [pastedElement.id]: pastedElement },
            }));
            handleElementSelect(pastedElement.id);
          }
        }}
        onDelete={() => {
          selectedElements.forEach(id => handleElementDelete(id));
        }}
        onGroup={() => {
          if (selectedElements.length > 1) {
            updateAnyComponent('visual-editor', 'group', { elementIds: selectedElements });
          }
        }}
        onUngroup={() => {
          selectedElements.forEach(id => {
            updateAnyComponent('visual-editor', 'ungroup', { elementId: id });
          });
        }}
        onAlignLeft={() => {
          if (selectedElements.length > 0) {
            const minX = Math.min(...selectedElements.map(id => project.elements[id]?.x ?? 0));
            selectedElements.forEach(id => handleElementUpdate(id, { x: minX }));
          }
        }}
        onAlignCenter={() => {
          if (selectedElements.length > 0) {
            const centerX = project.pageSettings.width / 2;
            selectedElements.forEach(id => {
              const el = project.elements[id];
              if (el) handleElementUpdate(id, { x: centerX - el.width / 2 });
            });
          }
        }}
        onAlignRight={() => {
          if (selectedElements.length > 0) {
            const maxRight = Math.max(...selectedElements.map(id => {
              const el = project.elements[id];
              return el ? el.x + el.width : 0;
            }));
            selectedElements.forEach(id => {
              const el = project.elements[id];
              if (el) handleElementUpdate(id, { x: maxRight - el.width });
            });
          }
        }}
        onDistributeHorizontally={() => {
          if (selectedElements.length >= 3) {
            const sorted = [...selectedElements].sort((a, b) => (project.elements[a]?.x ?? 0) - (project.elements[b]?.x ?? 0));
            const first = project.elements[sorted[0]];
            const last = project.elements[sorted[sorted.length - 1]];
            if (first && last) {
              const totalSpace = last.x - first.x;
              const step = totalSpace / (sorted.length - 1);
              sorted.forEach((id, i) => handleElementUpdate(id, { x: first.x + step * i }));
            }
          }
        }}
        onDistributeVertically={() => {
          if (selectedElements.length >= 3) {
            const sorted = [...selectedElements].sort((a, b) => (project.elements[a]?.y ?? 0) - (project.elements[b]?.y ?? 0));
            const first = project.elements[sorted[0]];
            const last = project.elements[sorted[sorted.length - 1]];
            if (first && last) {
              const totalSpace = last.y - first.y;
              const step = totalSpace / (sorted.length - 1);
              sorted.forEach((id, i) => handleElementUpdate(id, { y: first.y + step * i }));
            }
          }
        }}
        onBringToFront={() => {
          selectedElements.forEach(elementId => {
            setProject(prev => {
              const entries = Object.entries(prev.elements).filter(([k]) => k !== elementId);
              entries.push([elementId, prev.elements[elementId]]);
              return { ...prev, elements: Object.fromEntries(entries) };
            });
          });
        }}
        onSendToBack={() => {
          selectedElements.forEach(elementId => {
            setProject(prev => {
              const entries = Object.entries(prev.elements).filter(([k]) => k !== elementId);
              entries.unshift([elementId, prev.elements[elementId]]);
              return { ...prev, elements: Object.fromEntries(entries) };
            });
          });
        }}
        onOpenAssetLibrary={handleOpenAssetLibrary}
        onOpenScrollStories={handleOpenScrollStories}
        onOpenGoogleServices={handleOpenGoogleServices}
        onOpenNoteEditor={handleOpenNoteEditor}
        onRunQualityAnalysis={handleOpenQualityAnalysis}
        showUnifiedDashboard={showUnifiedDashboard}
        onToggleUnifiedDashboard={() => setShowUnifiedDashboard(!showUnifiedDashboard)}
        canUndo={canUndo}
        canRedo={canRedo}
        selectedElementsCount={selectedElements.length}
        totalElementsCount={totalElementsCount}
        projectName={project.name}
        isSaving={isSaving}
      />

      {/* Main Editor Area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <VisualEditorSidebar
          selectedClient={selectedClient}
          onClientSelect={(clientId) => onClientSelect?.({ id: clientId })}
          onComponentDrag={handleComponentDrag}
          onComponentAdd={handleElementAdd}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onOpenAssetLibrary={handleOpenAssetLibrary}
          onOpenScrollStories={handleOpenScrollStories}
          onOpenGoogleServices={handleOpenGoogleServices}
          onOpenNoteEditor={handleOpenNoteEditor}
          onOpenSettings={handleOpenGoogleServices}
        />

        {/* Canvas */}
        <VisualEditorCanvas
          project={project}
          selectedElements={selectedElements}
          onElementSelect={handleElementSelect}
          onElementUpdate={handleElementUpdate}
          onElementDelete={handleElementDelete}
          showGrid={showGrid}
          snapToGrid={snapToGrid}
          gridSize={gridSize}
          canvasZoom={canvasZoom}
          onCanvasZoomChange={setCanvasZoom}
          canvasPan={canvasPan}
          onCanvasPanChange={setCanvasPan}
          showRulers={showRulers}
          onShowRulersChange={setShowRulers}
          onElementDrag={(elementId: string, position: { x: number; y: number; r: number }) => {
            handleElementUpdate(elementId, { x: position.x, y: position.y });
          }}
          onElementResize={(elementId: string, size: { width: number; height: number }) => {
            handleElementUpdate(elementId, { width: size.width, height: size.height });
          }}
          isDragging={isDragging}
          draggedComponent={draggedComponent}
          onDragStart={handleComponentDrag}
          onDragEnd={handleDragEnd}
          onDrop={handleCanvasDrop}
        />

        {/* Right Sidebar */}
        <VisualEditorProperties
          selectedElement={selectedElement}
          onElementUpdate={handleElementUpdate}
          onElementDelete={handleElementDelete}
          onElementCopy={() => {
            if (selectedElement) {
              setClipboard(selectedElement);
            }
          }}
          onElementPaste={() => {
            if (clipboard) {
              const pastedElement: EditorElement = {
                ...clipboard,
                id: `element_${Date.now()}`,
                x: clipboard.x + 20,
                y: clipboard.y + 20,
              };
              setProject(prev => ({
                ...prev,
                elements: { ...prev.elements, [pastedElement.id]: pastedElement },
              }));
              handleElementSelect(pastedElement.id);
            }
          }}
          onElementLock={(elementId: string) => {
            handleElementUpdate(elementId, { props: { ...(project.elements[elementId]?.props ?? {}), locked: !project.elements[elementId]?.props?.locked } });
          }}
          onElementVisibility={(elementId: string) => {
            handleElementUpdate(elementId, { props: { ...(project.elements[elementId]?.props ?? {}), hidden: !project.elements[elementId]?.props?.hidden } });
          }}
          onElementDuplicate={(elementId: string) => {
            const original = project.elements[elementId];
            if (original) {
              const dup: EditorElement = { ...original, id: `element_${Date.now()}`, x: original.x + 20, y: original.y + 20 };
              setProject(prev => ({ ...prev, elements: { ...prev.elements, [dup.id]: dup } }));
              handleElementSelect(dup.id);
            }
          }}
          onElementGroup={(elementId: string) => {
            updateAnyComponent('visual-editor', 'group', { elementIds: [elementId, ...selectedElements] });
          }}
          onElementUngroup={(elementId: string) => {
            updateAnyComponent('visual-editor', 'ungroup', { elementId });
          }}
          onElementBringToFront={(elementId: string) => {
            const keys = Object.keys(project.elements);
            const last = keys[keys.length - 1];
            if (last !== elementId) {
              setProject(prev => {
                const entries = Object.entries(prev.elements).filter(([k]) => k !== elementId);
                entries.push([elementId, prev.elements[elementId]]);
                return { ...prev, elements: Object.fromEntries(entries) };
              });
            }
          }}
          onElementSendToBack={(elementId: string) => {
            const keys = Object.keys(project.elements);
            if (keys[0] !== elementId) {
              setProject(prev => {
                const entries = Object.entries(prev.elements).filter(([k]) => k !== elementId);
                entries.unshift([elementId, prev.elements[elementId]]);
                return { ...prev, elements: Object.fromEntries(entries) };
              });
            }
          }}
          onElementAlign={(elementId: string) => {
            const el = project.elements[elementId];
            if (el) {
              handleElementUpdate(elementId, { x: project.pageSettings.width / 2 - el.width / 2 });
            }
          }}
          onElementDistribute={(elementId: string) => {
            const el = project.elements[elementId];
            if (el) {
              handleElementUpdate(elementId, { y: project.pageSettings.height / 2 - el.height / 2 });
            }
          }}
          selectedElements={selectedElements}
          canPaste={clipboard !== null}
        />

        {/* Integration Demo Panel */}
        <Box sx={{ width: 300, borderLeft: 1, borderColor: 'divider', p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Integration Demo</Typography>
          
          {/* Database Status */}
          <Box sx={{ mb: 2, p: 1, bgcolor: dbConnected ? 'success.light' : 'error.light', borderRadius: 1 }}>
            <Typography variant="body2" color="white">
              Database: {dbConnected ? '✅ Connected' : '❌ Disconnected'}
            </Typography>
            {lastAutoSave && (
              <Typography variant="caption" color="white">
                Last auto-save: {lastAutoSave.toLocaleTimeString()}
              </Typography>
            )}
          </Box>
          
          <Typography variant="body2" color="textSecondary" gutterBottom>
            These buttons demonstrate how the visual editor can update any component: </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => updateAnyComponent('admin-dashboard', 'refresh', { source: 'visual-editor' })}
            >
              Update Admin Dashboard
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={() => updateAnyComponent('analytics-panel', 'track', { event: 'element_created', data: project })}
            >
              Track in Analytics
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={() => triggerComponentAction('notification-widget', 'show', { message: 'Project updated!', type: 'success' })}
            >
              Show Notification
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={() => updateAnyComponent('client-portal', 'updateProject', { project, client: selectedClient })}
            >
              Update Client Portal
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={async () => {
                const data = await getDataFromComponent('admin-dashboard', 'selectedUser');
              }}
            >
              Get Admin Data
            </Button>
            
            <Button 
              variant="outlined" 
              size="small"
              onClick={() => {
                // Broadcast to all components
                integration.emit('visual-editor:broadcast', { 
                  message: 'Hello from Visual Editor!', 
                  project: project.name,
                  timestamp: Date.now()
                  });
            }}
            >
              Broadcast to All
            </Button>
            
            <Button 
              variant="outlined" 
              size="small"
              onClick={() => handleLoadProject('default-project')}
              disabled={!dbConnected}
            >
              Load project from database
            </Button>
            
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleSaveAsTemplate('My template name')}
              disabled={!dbConnected}
            >
              Save as template
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={() => handleSyncProjectChanges({ elements: project.elements })}
              disabled={!dbConnected}
            >
              Sync changes
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={() => handleBroadcastCursorPosition({ x: 100, y: 200 })}
            >
              Broadcast cursor
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={() => setBrandingPanelOpen(true)}
              sx={{
                borderColor: branding.color,
                  color: branding.color,
                  fontWeight: 600, '&:hover': {
                  bgcolor: `${branding.color}15`,
                  borderColor: branding.color
              }
            }}
            >
              🎨 Customize branding
            </Button>
          </Box>
          
          {/* Current Branding Info */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'white', borderRadius: 1, border: `2px solid ${branding.color}` }}>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                Active branding (Optional) if you want to add a name. If you don't want to add a name, you can leave it blank. If you want to add a description, you can add it here. If you don't want to add a description, you can leave it blank.
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: branding.color }}>
              {branding.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Box sx={{ width: 20, height: 20, bgcolor: branding.color, borderRadius: 0.5 }} />
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {branding.color}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Unified Dashboard Section */}
      {showUnifiedDashboard && (
        <Box  sx={{ height: '50vh', borderTop: 1, borderColor: 'divider', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column'}}>
            {/* Dashboard Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
              <Tabs
                value={selectedView}
                onChange={(_, newValue: string | number) => setSelectedView(String(newValue))}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 48 }}
              >
                <Tab label="Templates" value="templates" />
                <Tab label="Export Presets" value="export-presets" />
                <Tab label="Cloud Sync" value="cloud-sync" />
                <Tab label="Team Collaboration" value="team-collaboration" />
                <Tab label="Plugins" value="plugins" />
                <Tab label="Animations" value="animations" />
                <Tab label="Component Library" value="component-library" />
                <Tab label="Design System" value="design-system" />
                <Tab label="Analytics" value="analytics" />
                <Tab label="SEO" value="seo" />
                <Tab label="Audit Logs" value="audit" />
                <Tab label="Monitoring" value="monitoring" />
                <Tab label="System Management" value="system-management" />
            <Tab label="ML Optimization" value="ml-optimization" />
            <Tab label="Advanced Analytics" value="advanced-analytics" />
            <Tab label="AI Assistance" value="ai-assistance" />
                <Tab label="Templates & Presets" value="templates-presets" />
                <Tab label="Client Communication" value="client-communication" />
                <Tab label="Revenue Optimization" value="revenue-optimization" />
                <Tab label="Team Collaboration" value="team-collaboration" />
                <Tab label="Brand Customization" value="branding" />
                <Tab label="Landing Settings" value="landing-settings" />
                <Tab label="Showcase Publisher" value="showcase-publisher" />
                <Tab label="🎨 Theming Admin" value="theming-admin" />
              </Tabs>
            </Box>

            {/* Dashboard Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {selectedView === 'templates' && (
                <TemplateDashboard
                  onTemplatesClick={() => {
                    updateAnyComponent('template-dashboard', 'templates:open', { source: 'visual-editor' });
                }}
                  onCategoriesClick={() => {
                    updateAnyComponent('template-dashboard', 'categories:open', { source: 'visual-editor' });
                }}
                  onSearchClick={() => {
                    updateAnyComponent('template-dashboard', 'search:open', { source: 'visual-editor' });
                }}  
                />
              )}
              
              {selectedView === 'export-presets' && (
                <ExportPresetsDashboard
                  onPresetsClick={() => {
                    updateAnyComponent('export-presets-dashboard', 'presets:open', { source: 'visual-editor' });
                }}
                />
              )}
              
              {selectedView === 'cloud-sync' && (
                <CloudSyncDashboard
                  onSyncClick={() => {
                    updateAnyComponent('cloud-sync-dashboard', 'sync:open', { source: 'visual-editor' });
                }}
                />
        )}

              {selectedView === 'plugins' && (
                <PluginDashboard
                  onHooksClick={() => {
                    updateAnyComponent('plugin-dashboard', 'hooks:open', { source: 'visual-editor' });
                }}
                  onComponentsClick={() => {
                    updateAnyComponent('plugin-dashboard', 'components:open', { source: 'visual-editor' });
                }}
                  onUtilitiesClick={() => {
                    updateAnyComponent('plugin-dashboard', 'utilities:open', { source: 'visual-editor' });
                }}
                  onThemesClick={() => {
                    updateAnyComponent('plugin-dashboard', 'themes:open', { source: 'visual-editor' });
                }}
                />
              )}
              
              {selectedView === 'animations' && (
                <AnimationDashboard
                  onAnimationsClick={() => {
                    updateAnyComponent('animation-dashboard', 'animations:open', { source: 'visual-editor' });
                }}
                  onTimelineClick={() => {
                    updateAnyComponent('animation-dashboard', 'timeline:open', { source: 'visual-editor' });
                }}
                  onKeyframesClick={() => {
                    updateAnyComponent('animation-dashboard', 'keyframes:open', { source: 'visual-editor' });
                }}
                  onPreviewClick={() => {
                    updateAnyComponent('animation-dashboard', 'preview:open', { source: 'visual-editor' });
                }}
                />
              )}
              
              {selectedView === 'component-library' && (
                <ComponentLibraryDashboard
                  onLibraryClick={() => {
                    updateAnyComponent('component-library-dashboard', 'library:open', { source: 'visual-editor' });
                }}
                  onCategoriesClick={() => {
                    updateAnyComponent('component-library-dashboard', 'categories:open', { source: 'visual-editor' });
                }}
                  onTagsClick={() => {
                    updateAnyComponent('component-library-dashboard', 'tags:open', { source: 'visual-editor' });
                }}
                  onDocumentationClick={() => {
                    updateAnyComponent('component-library-dashboard', 'documentation:open', { source: 'visual-editor' });
                }}
                />
              )}
              
              {selectedView === 'design-system' && (
                <DesignSystemDashboard
                  onTokensClick={() => {
                    updateAnyComponent('design-system-dashboard', 'tokens:open', { source: 'visual-editor' });
                }}
                  onGuidelinesClick={() => {
                    updateAnyComponent('design-system-dashboard', 'guidelines:open', { source: 'visual-editor' });
                }}
                  onThemesClick={() => {
                    updateAnyComponent('design-system-dashboard', 'themes:open', { source: 'visual-editor' });
                }}
                  onDocumentationClick={() => {
                    updateAnyComponent('design-system-dashboard', 'documentation:open', { source: 'visual-editor' });
                }}
                />
              )}
              
              {selectedView === 'analytics' && (
                <AnalyticsDashboard
                  onAnalyticsClick={() => {
                    updateAnyComponent('analytics-dashboard', 'analytics:open', { source: 'visual-editor' });
                }}
                  onExportClick={() => {
                    updateAnyComponent('analytics-dashboard', 'export:open', { source: 'visual-editor' });
                }}
                />
              )}

              {selectedView === 'seo' && (
                <SEODashboard
                  onCrawlClick={() => {
                    updateAnyComponent('seo-dashboard', 'crawl:open', { source: 'visual-editor' });
                }}
                  onAnalyzeClick={() => {
                    updateAnyComponent('seo-dashboard', 'analyze:open', { source: 'visual-editor' });
                }}
                  onKeywordsClick={() => {
                    updateAnyComponent('seo-dashboard', 'keywords:open', { source: 'visual-editor' });
                }}
                  onCompetitorsClick={() => {
                    updateAnyComponent('seo-dashboard', 'competitors:open', { source: 'visual-editor' });
                }}
                  onSchemaClick={() => {
                    updateAnyComponent('seo-dashboard', 'schema:open', { source: 'visual-editor' });
                }}
                  onReportsClick={() => {
                    updateAnyComponent('seo-dashboard', 'reports:open', { source: 'visual-editor' });
                }}
                  onSettingsClick={() => {
                    updateAnyComponent('seo-dashboard', 'settings:open', { source: 'visual-editor' });
                }}
                />
              )}
              
              {selectedView === 'audit' && (
                <AuditDashboard
                  onAuditClick={() => {
                    updateAnyComponent('audit-dashboard', 'audit:open', { source: 'visual-editor' });
                }}
                  onAuditManagementClick={() => {
                    updateAnyComponent('audit-dashboard', 'audit-management:open', { source: 'visual-editor' });
                }}
                  onAlertsClick={() => {
                    updateAnyComponent('audit-dashboard', 'alerts:open', { source: 'visual-editor' });
                }}
                  onExportClick={() => {
                    updateAnyComponent('audit-dashboard', 'export:open', { source: 'visual-editor' });
                }}
                />
              )}
              
              {selectedView === 'monitoring' && (
                <MonitoringDashboard
                  onMonitoringClick={() => {
                    updateAnyComponent('monitoring-dashboard', 'monitoring:open', { source: 'visual-editor' });
                }}
                  onCachingClick={() => {
                    updateAnyComponent('monitoring-dashboard', 'caching:open', { source: 'visual-editor' });
                }}
                  onSystemManagementClick={() => {
                    updateAnyComponent('monitoring-dashboard', 'system-management:open', { source: 'visual-editor' });
                }}
                />
              )}
              
        {selectedView === 'system-management' && (
          <SystemManagementDashboard
            onSystemManagementClick={() => {
              updateAnyComponent('system-management-dashboard', 'system-management:open', { source: 'visual-editor' });
          }}
            onAlertsClick={() => {
              updateAnyComponent('system-management-dashboard', 'alerts:open', { source: 'visual-editor' });
          }}
            onMetricsClick={() => {
              updateAnyComponent('system-management-dashboard', 'metrics:open', { source: 'visual-editor' });
          }}
            onScalingClick={() => {
              updateAnyComponent('system-management-dashboard', 'scaling:open', { source: 'visual-editor' });
          }}
            onBackupClick={() => {
              updateAnyComponent('system-management-dashboard', 'backup:open', { source: 'visual-editor' });
          }}
            onRecoveryClick={() => {
              updateAnyComponent('system-management-dashboard', 'recovery:open', { source: 'visual-editor' });
          }}
          />
        )}

        {selectedView === 'ml-optimization' && (
          <MLOptimizationDashboard
            onMLOptimizationClick={() => {
              updateAnyComponent('ml-optimization-dashboard', 'ml-optimization:open', { source: 'visual-editor' });
          }}
            onMLModelsClick={() => {
              updateAnyComponent('ml-optimization-dashboard', 'ml-models:open', { source: 'visual-editor' });
          }}
            onMLPredictionsClick={() => {
              updateAnyComponent('ml-optimization-dashboard', 'ml-predictions:open', { source: 'visual-editor' });
          }}
            onOptimizationsClick={() => {
              updateAnyComponent('ml-optimization-dashboard', 'optimizations:open', { source: 'visual-editor' });
          }}
            onAnalyticsClick={() => {
              updateAnyComponent('ml-optimization-dashboard', 'analytics:open', { source: 'visual-editor' });
          }}
            onMLTrainingClick={() => {
              updateAnyComponent('ml-optimization-dashboard', 'ml-training:open', { source: 'visual-editor' });
          }}
          />
        )}

        {selectedView === 'advanced-analytics' && (
          <AdvancedAnalyticsDashboard
            onAdvancedAnalyticsClick={() => {
              updateAnyComponent('advanced-analytics-dashboard', 'advanced-analytics:open', { source: 'visual-editor' });
          }}
            onHeatmapsClick={() => {
              updateAnyComponent('advanced-analytics-dashboard', 'heatmaps:open', { source: 'visual-editor' });
          }}
            onAdvancedAnalyticsBehaviorClick={() => {
              updateAnyComponent('advanced-analytics-dashboard', 'advanced-analytics-behavior:open', { source: 'visual-editor' });
          }}
            onFunnelsClick={() => {
              updateAnyComponent('advanced-analytics-dashboard', 'funnels:open', { source: 'visual-editor' });
          }}
            onAdvancedAnalyticsTestsClick={() => {
              updateAnyComponent('advanced-analytics-dashboard', 'advanced-analytics-tests:open', { source: 'visual-editor' });
          }}
            onAdvancedAnalyticsInsightsClick={() => {
              updateAnyComponent('advanced-analytics-dashboard', 'advanced-analytics-insights:open', { source: 'visual-editor' });
          }}
          />
        )}

        {selectedView === 'ai-assistance' && (
          <AIAssistanceDashboard
            onAISettingsClick={() => {
              updateAnyComponent('ai-assistance-dashboard', 'ai-settings:open', { source: 'visual-editor' });
          }}
            onAISuggestionsClick={() => {
              updateAnyComponent('ai-assistance-dashboard', 'ai-suggestions:open', { source: 'visual-editor' });
          }}
            onAIConversationsClick={() => {
              updateAnyComponent('ai-assistance-dashboard', 'ai-conversations:open', { source: 'visual-editor' });
          }}
            onCodeGenerationClick={() => {
              updateAnyComponent('ai-assistance-dashboard', 'code-generation:open', { source: 'visual-editor' });
          }}
            onDesignSuggestionsClick={() => {
              updateAnyComponent('ai-assistance-dashboard', 'design-suggestions:open', { source: 'visual-editor' });
          }}
            onWorkflowsClick={() => {
              updateAnyComponent('ai-assistance-dashboard', 'workflows:open', { source: 'visual-editor' });
          }}
          />
        )}

        {selectedView === 'templates-presets' && (
          <TemplatePresetDashboard
            onTemplatesPresetsSettingsClick={() => {
              updateAnyComponent('template-preset-dashboard', 'templates-presets-settings:open', { source: 'visual-editor' });
          }}
            onTemplatesPresetsCategoriesClick={() => {
              updateAnyComponent('template-preset-dashboard', 'templates-presets-categories:open', { source: 'visual-editor' });
          }}
            onTemplatesPresetsImportClick={() => {
              updateAnyComponent('template-preset-dashboard', 'templates-presets-import:open', { source: 'visual-editor' });
          }}
            onTemplatesPresetsExportClick={() => {
              updateAnyComponent('template-preset-dashboard', 'templates-presets-export:open', { source: 'visual-editor' });
          }}
          />
        )}

        {selectedView === 'client-communication' && (
          <ClientCommunicationDashboard
            onClientCommunicationSettingsClick={() => {
              updateAnyComponent('client-communication-dashboard', 'client-communication-settings:open', { source: 'visual-editor' });
          }}
            onClientCommunicationTemplatesClick={() => {
              updateAnyComponent('client-communication-dashboard', 'client-communication-templates:open', { source: 'visual-editor' });
          }}
            onClientCommunicationSegmentsClick={() => {
              updateAnyComponent('client-communication-dashboard', 'client-communication-segments:open', { source: 'visual-editor' });
          }}
            onClientCommunicationAutomationClick={() => {
              updateAnyComponent('client-communication-dashboard', 'client-communication-automation:open', { source: 'visual-editor' });
          }}
            onClientCommunicationAnalyticsClick={() => {
              updateAnyComponent('client-communication-dashboard', 'client-communication-analytics:open', { source: 'visual-editor' });
          }}
            onClientCommunicationDeadlinesClick={() => {
              updateAnyComponent('client-communication-dashboard', 'client-communication-deadlines:open', { source: 'visual-editor' });
          }}
          />
        )}

        {selectedView === 'revenue-optimization' && (
          <RevenueOptimizationDashboard
            onRevenueOptimizationSettingsClick={() => {
              updateAnyComponent('revenue-optimization-dashboard', 'revenue-optimization-settings:open', { source: 'visual-editor' });
          }}
            onRevenueOptimizationPricingClick={() => {
              updateAnyComponent('revenue-optimization-dashboard', 'revenue-optimization-pricing:open', { source: 'visual-editor' });
          }}
            onRevenueOptimizationUpsellingClick={() => {
              updateAnyComponent('revenue-optimization-dashboard', 'revenue-optimization-upselling:open', { source: 'visual-editor' });
          }}
            onRevenueOptimizationForecastingClick={() => {
              updateAnyComponent('revenue-optimization-dashboard', 'revenue-optimization-forecasting:open', { source: 'visual-editor' });
          }}
            onRevenueOptimizationAnalysisClick={() => {
              updateAnyComponent('revenue-optimization-dashboard', 'revenue-optimization-analysis:open', { source: 'visual-editor' });
          }}
            onRevenueOptimizationRatesClick={() => {
              updateAnyComponent('revenue-optimization-dashboard', 'revenue-optimization-rates:open', { source: 'visual-editor' });
          }}
          />
        )}

              {selectedView === 'team-collaboration' && (
                <TeamCollaborationDashboard
                  onTeamCollaborationSettingsClick={() => {
                    updateAnyComponent('team-collaboration-dashboard', 'team-collaboration-settings:open', { source: 'visual-editor' });
                  }}
                  onTeamCollaborationMembersClick={() => {
                    updateAnyComponent('team-collaboration-dashboard', 'team-collaboration-members:open', { source: 'visual-editor' });
                  }}
                />
              )}
              
              {selectedView === 'branding' && (
                <Box sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom sx={{ color: branding.color, fontFamily: branding.typography.fontFamily.primary }}>
                    🎨 CreatorHub Branding Customization
                  </Typography>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                    Customize your CreatorHub branding to match your profession and style. All changes apply across the entire platform.
                  </Typography>
                  
                  {/* Current Branding Preview */}
                  <Box sx={{ mb: 4, p: 3, bgcolor: 'grey.50', borderRadius: 2, border: `2px solid ${branding.color}` }}>
                    <Typography variant="h6" gutterBottom>Current Branding</Typography>
                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="caption" color="textSecondary">Brand Name</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600}}>{branding.name}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="textSecondary">Primary Color</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 32, height: 32, bgcolor: branding.color, borderRadius: 1, border: '1px solid rgba(0,0,0,0.1)' }} />
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{branding.color}</Typography>
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="textSecondary">Typography</Typography>
                        <Typography variant="body2" sx={{ fontFamily: branding.typography.fontFamily.primary }}>
                          {branding.typography.fontFamily.primary.split(', ')[0].replace(/"/g,', ')}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Profession Selector */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                      Profession (Optional)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {(['photographer','videographer','music_producer','vendor','admin'] as const).map((prof) => {
                        const profBranding = branding.getProfessionBranding(prof);
                        const isSelected = brandingProfession === prof;

                        return (
                          <Button
                            key={prof}
                            variant={isSelected ? 'contained' : 'outlined'}
                            onClick={() => setBrandingProfession(prof)}
                            sx={{
                              ...branding.getButtonProps(isSelected ? 'contained' : 'outlined').sx,
                              borderColor: profBranding.color,
                              color: isSelected ? '#fff' : profBranding.color,
                              bgcolor: isSelected ? profBranding.color : 'transparent','&:hover': {
                                bgcolor: isSelected ? profBranding.color : `${profBranding.color}15`,
                                borderColor: profBranding.color
                              }
                            }}
                          >
                            {profBranding.icon && <span style={{ marginRight: 8 }}>📸</span>}
                            {profBranding.name}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>

                  {/* Project Category Selector */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                      Project Category (Optional)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {(['wedding','corporate','photography','videography','music'] as const).map((category) => {
                        const categoryBranding = branding.getProjectCategoryBranding(category);
                        const isSelected = brandingCategory === category;

                        return (
                          <Button
                            key={category}
                            variant={isSelected ? 'contained' : 'outlined'}
                            onClick={() => setBrandingCategory(isSelected ? undefined : category)}
                            size="small"
                            sx={{
                              borderColor: categoryBranding.color,
                              color: isSelected ? '#fff' : categoryBranding.color,
                              bgcolor: isSelected ? categoryBranding.color : 'transparent','&:hover': {
                                bgcolor: isSelected ? categoryBranding.color : `${categoryBranding.color}15`
                              }
                            }}
                          >
                            {categoryBranding.name}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>

                  {/* Custom Color Picker */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                      Brand Color (Optional)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={customBrandColor || branding.color}
                        onChange={(e) => setCustomBrandColor(e.target.value)}
                        style={{
                          width: 60,
                          height: 60,
                          border: 'none',
                          borderRadius: 8,
                          cursor: 'pointer'
                        }}
                      />
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Brand color (Optional)
                        </Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ fontFamily: 'monospace' }}>
                          {customBrandColor || branding.color}
                        </Typography>
                      </Box>
                      {customBrandColor && (
                        <Button 
                          size="small" 
                          onClick={() => setCustomBrandColor(undefined)}
                          sx={{ ml: 'auto' }}
                        >
                          Reset to default
                        </Button>
                      )}
                    </Box>
                  </Box>
                  
                  {/* Component Preview with Current Branding */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                      Component Previews
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* Button Previews */}
                      <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)' }}>
                        <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                          Buttons
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Button variant="contained" {...branding.getButtonProps('contained')}>
                            Primary Button
                          </Button>
                          <Button variant="outlined" {...branding.getButtonProps('outlined')}>
                            Outlined Button
                          </Button>
                          <Button variant="text" {...branding.getButtonProps('text')}>
                            Text Button
                          </Button>
                        </Box>
                      </Box>
                      
                      {/* Card Preview */}
                      <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)' }}>
                        <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                          Card Component
                        </Typography>
                        <Box {...branding.getCardProps()} sx={{ ...branding.getCardProps().sx, p: 2 }}>
                          <Typography variant="h6" {...branding.getTextProps('primary')}>
                            Sample Card Title
                          </Typography>
                          <Typography variant="body2" {...branding.getTextProps('secondary')}>
                            This is how your cards will look with the current branding settings.
                          </Typography>
                        </Box>
                      </Box>
                      
                      {/* Icon Preview */}
                      <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)' }}>
                        <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                          Icons
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <Box {...branding.getIconProps(32)}>
                            <Typography sx={{ fontSize: 32 }}>🎨</Typography>
                          </Box>
                          <Box {...branding.getIconProps(24)}>
                            <Typography sx={{ fontSize: 24 }}>📸</Typography>
                          </Box>
                          <Box {...branding.getIconProps(16)}>
                            <Typography sx={{ fontSize: 16 }}>🎬</Typography>
                          </Box>
                        </Box>
                      </Box>
                      
                      {/* Typography Preview */}
                      <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)' }}>
                        <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                          Typography Styles
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Typography variant="h4" {...branding.getTextProps('primary')}>
                            Heading Text
                          </Typography>
                          <Typography variant="body1" {...branding.getTextProps('secondary')}>
                            Body text with secondary styling
                          </Typography>
                          <Typography variant="caption" {...branding.getTextProps('accent')}>
                            Accent caption text
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                  
                  {/* Design Tokens Display */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                      Design Tokens
                    </Typography>
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                      {/* Colors */}
                      <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)' }}>
                        <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block', fontWeight: 600}}>
                          Colors
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {Object.entries(branding.colors).slice(0, 5).map(([name, value]) => (
                            <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 20, height: 20, bgcolor: value as string, borderRadius: 0.5, border: '1px solid rgba(0,0,0,0.1)' }} />
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                                {name}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      
                      {/* Spacing */}
                      <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)' }}>
                        <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block', fontWeight: 600}}>
                          Spacing
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {Object.entries(branding.spacing).map(([name, value]) => (
                            <Typography key={name} variant="caption" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                              {name}: {value}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                      
                      {/* Border Radius */}
                      <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)' }}>
                        <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block', fontWeight: 600}}>
                          Border Radius
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {Object.entries(branding.borderRadius).map(([name, value]) => (
                            <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 24, height: 24, bgcolor: branding.color, borderRadius: value as string }} />
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                                {name}: {value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      
                      {/* Shadows */}
                      <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)' }}>
                        <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block', fontWeight: 600}}>
                          Shadows
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {Object.entries(branding.shadows).slice(0, 4).map(([name, value]) => (
                            <Box 
                              key={name} 
                              sx={{ 
                                p: 1, 
                                bgcolor: 'white', 
                                boxShadow: value as string,
                                borderRadius: 1,
                                textAlign: 'center'
                            }}
                            >
                              <Typography variant="caption" sx={{ fontSize: 9 }}>
                                {name}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                  
                  {/* Quick Actions */}
                  <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                    <Button
                      variant="contained"
                      onClick={() => {
                        // Apply branding to all components
                        communication.sendBroadcast('branding:update', {
                          profession: brandingProfession,
                          category: brandingCategory,
                          customColor: customBrandColor,
                          branding: branding
                      });
                        addNotification({
                          title: 'Branding Applied',
                          message: `${branding.name} branding applied to all components`,
                          type: 'success',
                          read: false
                        });
                      }}
                      sx={{ bgcolor: branding.color, '&:hover': { bgcolor: branding.color + 'dd' } }}
                    >
                      Apply Branding Globally
                    </Button>

                    <Button
                      variant="outlined"
                      onClick={() => {
                        setBrandingProfession('photographer');
                        setBrandingCategory(undefined);
                        setCustomBrandColor(undefined);
                      }}
                    >
                      Reset to default
                    </Button>
                    
                    <Button
                      variant="outlined"
                      onClick={() => {
                        const brandData = {
                          profession: brandingProfession,
                          category: brandingCategory,
                          customColor: customBrandColor,
                          timestamp: new Date().toISOString()
                      };
                        navigator.clipboard.writeText(JSON.stringify(brandData, null, 2));
                        addNotification({
                          title: 'Branding Config Copied',
                          message: 'Branding configuration copied to clipboard',
                          type: 'success',
                          read: false
                      });
                    }}
                    >
                      Export configuration
                    </Button>
                  </Box>
                  
                  {/* Brand Description */}
                  <Box sx={{ mt: 4, p: 2, bgcolor: 'info.light', borderRadius: 2, borderLeft: `4px solid ${branding.color}` }}>
                    <Typography variant="body2" sx={{ color: 'info.dark' }}>
                      <strong>About {branding.name}:</strong> {branding.description} (Optional) if you want to add a description.
                    </Typography>
                  </Box>
                </Box>
              )}

              {selectedView === 'landing-settings' && <LandingSettingsPanel />}

              {selectedView === 'showcase-publisher' && <ShowcasePublisherPanel />}

              {/* NEW: Theming Admin Panel */}
              {selectedView === 'theming-admin' && <ThemingAdminPanel />}
            </Box>
          </Box>
        </Box>
      )}

      {/* Dialogs */}
      <Dialog open={scrollStoriesOpen} onClose={() => setScrollStoriesOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Scroll Stories</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            <Typography>Scroll Stories functionality will be implemented here</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScrollStoriesOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assetLibraryOpen} onClose={() => setAssetLibraryOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Asset Library</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            <Typography>Asset Library functionality will be implemented here</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssetLibraryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={qualityAnalysisOpen} onClose={() => setQualityAnalysisOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Quality Analysis</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            <Typography>Quality Analysis functionality will be implemented here</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQualityAnalysisOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={googleServicesOpen} onClose={() => setGoogleServicesOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Google Services</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            <Typography>Google Services functionality will be implemented here</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGoogleServicesOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={noteEditorOpen} onClose={() => setNoteEditorOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Notes</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            <Typography>Note Editor functionality will be implemented here</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteEditorOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={seoDashboardOpen} onClose={() => setSeoDashboardOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle>Advanced SEO Dashboard</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            <SEODashboard
              onCrawlClick={() => {
                updateAnyComponent('seo-dashboard', 'crawl:open', { source: 'visual-editor' });
                setSeoDashboardOpen(false);
            }}
              onAnalyzeClick={() => {
                updateAnyComponent('seo-dashboard', 'analyze:open', { source: 'visual-editor' });
                setSeoDashboardOpen(false);
            }}
              onKeywordsClick={() => {
                updateAnyComponent('seo-dashboard', 'keywords:open', { source: 'visual-editor' });
                setSeoDashboardOpen(false);
            }}
              onCompetitorsClick={() => {
                updateAnyComponent('seo-dashboard', 'competitors:open', { source: 'visual-editor' });
                setSeoDashboardOpen(false);
            }}
              onSchemaClick={() => {
                updateAnyComponent('seo-dashboard', 'schema:open', { source: 'visual-editor' });
                setSeoDashboardOpen(false);
            }}
              onReportsClick={() => {
                updateAnyComponent('seo-dashboard', 'reports:open', { source: 'visual-editor' });
                setSeoDashboardOpen(false);
            }}
              onSettingsClick={() => {
                updateAnyComponent('seo-dashboard', 'settings:open', { source: 'visual-editor' });
                setSeoDashboardOpen(false);
            }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeoDashboardOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Branding Customization Dialog */}
      <Dialog open={brandingPanelOpen} onClose={() => setBrandingPanelOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ bgcolor: branding.color, color: 'white' }}>
          🎨 CreatorHub Branding Customization
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Customize your CreatorHub branding to match your profession and style. All changes apply across the entire platform.
            </Typography>
            
            {/* Current Branding Preview */}
            <Box sx={{ mb: 4, p: 3, bgcolor: 'grey.50', borderRadius: 2, border: `2px solid ${branding.color}` }}>
              <Typography variant="h6" gutterBottom>Current Branding</Typography>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="textSecondary">Brand Name</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600}}>{branding.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">Primary Color</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 32, height: 32, bgcolor: branding.color, borderRadius: 1, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{branding.color}</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
            
            {/* Profession Selector */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                Select Your Profession
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {(['photographer','videographer','music_producer', 'vendor', 'admin'] as const).map((prof) => {
                  const profBranding = branding.getProfessionBranding(prof);
                  const isSelected = brandingProfession === prof;

                  return (
                    <Button
                      key={prof}
                      variant={isSelected ? 'contained' : 'outlined'}
                      onClick={() => setBrandingProfession(prof)}
                      sx={{
                        borderColor: profBranding.color,
                        color: isSelected ? '#fff' : profBranding.color,
                        bgcolor: isSelected ? profBranding.color : 'transparent', '&:hover': {
                          bgcolor: isSelected ? profBranding.color : `${profBranding.color}15`,
                          borderColor: profBranding.color
                        }
                      }}
                    >
                      {profBranding.name}
                    </Button>
                  );
                })}
              </Box>
            </Box>

            {/* Custom Color Picker */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                Custom Brand Color
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <input
                  type="color"
                  value={customBrandColor || branding.color}
                  onChange={(e) => setCustomBrandColor(e.target.value)}
                  style={{
                    width: 60,
                    height: 60,
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer'
                  }}
                />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Choose your custom brand color
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontFamily: 'monospace' }}>
                    {customBrandColor || branding.color}
                  </Typography>
                </Box>
                {customBrandColor && (
                  <Button 
                    size="small" 
                    onClick={() => setCustomBrandColor(undefined)}
                    sx={{ ml: 'auto' }}
                  >
                    Reset to Default
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBrandingPanelOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              communication.sendBroadcast('branding:update', {
                profession: brandingProfession,
                category: brandingCategory,
                customColor: customBrandColor,
                branding: branding
            });
              addNotification({
                title: 'Branding Applied',
                message: `${branding.name} branding applied to all components`,
                type: 'success',
                read: false
              });
              setBrandingPanelOpen(false);
            }}
            sx={{ bgcolor: branding.color, '&:hover': { bgcolor: branding.color +'dd' } }}
          >
            Apply Branding
          </Button>
        </DialogActions>
      </Dialog>

      {/* Branding Workflow Panel */}
      <BrandingWorkflowPanel
        open={brandingPanelOpen}
        onClose={() => setBrandingPanelOpen(false)}
      />

      {/* Logo Management Panel */}
      <LogoManagementPanel
        open={logoManagementOpen}
        onClose={() => setLogoManagementOpen(false)}
      />
    </Box>
  );
};

// Wrapper component that provides the context
const CreatorhubVisualEditorRefactored: React.FC<CreatorhubVisualEditorProps> = (props) => {
  return (
    <VisualEditorProvider>
      <div>
        <CreatorhubVisualEditorContent {...props} />
      </div>
    </VisualEditorProvider>
  );
};

export default CreatorhubVisualEditorRefactored;
