/**
 * Enhanced Visual Editor Page - Integrates all advanced features
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Fab,
  Drawer,
  Tabs,
  Tab,
  Typography,
  Divider,
  Button,
  Stack,
  TextField,
} from '@mui/material';
import {
  Code,
  Visibility,
  Accessible,
  CloudUpload,
  Keyboard,
  Folder,
  DashboardCustomize,
  AutoAwesome,
  Tune,
  Settings as SettingsIcon,
} from '@mui/icons-material';

// Existing components
import { VisualEditorProvider, useVisualEditor, EditorElement, Project } from './VisualEditorContext';
import { EnhancedTopToolbar } from './EnhancedTopToolbar';
import { FabricCanvas } from './FabricCanvas';
import VisualEditorSidebar from './VisualEditorSidebar';
import { EnhancedPropertiesPanel } from './EnhancedPropertiesPanel';

// New enhanced components
import { CodeEditorPanel } from './CodeEditorPanel';
import { LivePreviewPanel } from './LivePreviewPanel';
import { AccessibilityChecker } from './AccessibilityChecker';
import { PlatformExporter } from './PlatformExporter';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ComponentLibrary } from './ComponentLibrary';
import { UnifiedCodeStudio } from './UnifiedCodeStudio';
import { getVisualEditorTokens } from './visualEditorTokens';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useDatabase } from '@/hooks/useDatabase';
import ModalCreator from './ModalCreator';
import DashboardComponentManager from './DashboardComponentManager';
import LibrarySuggestionDialog from './LibrarySuggestionDialog';
import ProfessionConfigWizard, { ProfessionConfiguration } from './ProfessionConfigWizard';
import ToastDesigner from './ToastDesigner';
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

/** Shape passed by ComponentLibrary's onUseComponent callback */
interface LibraryComponent {
  id: string;
  name: string;
  category?: string;
  props?: Record<string, unknown>;
}

interface EnhancedVisualEditorPageProps {
  projectId?: string;
}

interface IntegrationMessage {
  type?: unknown;
  from?: unknown;
  to?: unknown;
  data?: unknown;
  [key: string]: unknown;
}

interface IntegrationStateSnapshot {
  projectId: string;
  projectName: string;
  elements: EditorElement[];
  activeTab: AdvancedWorkspaceTab;
  timestamp: number;
}

type AdvancedWorkspaceTab =
  | 'templates'
  | 'export-presets'
  | 'cloud-sync'
  | 'team-collaboration'
  | 'plugins'
  | 'animations'
  | 'component-library'
  | 'design-system'
  | 'analytics'
  | 'audit'
  | 'monitoring'
  | 'system-management'
  | 'ml-optimization'
  | 'advanced-analytics'
  | 'ai-assistance'
  | 'templates-presets'
  | 'template-presets'
  | 'client-communication'
  | 'revenue-optimization'
  | 'seo'
  | 'modals'
  | 'dashboard-components'
  | 'toasts'
  | 'branding'
  | 'landing-settings'
  | 'showcase-publisher'
  | 'theming-admin'
  | 'integration-tools';

const VALID_ELEMENT_TYPES: EditorElement['type'][] = [
  'button', 'text', 'image', 'card', 'container', 'grid', 'audio', 'video',
];

const toElementType = (raw: string): EditorElement['type'] => {
  const lower = raw.toLowerCase() as EditorElement['type'];
  return VALID_ELEMENT_TYPES.includes(lower) ? lower : 'container';
};

export const EnhancedVisualEditorContent: React.FC = () => {
  const { state, dispatch, saveProject, loadProject } = useVisualEditor();
  const { integration, communication, dataFlow } = useEnhancedMasterIntegration();
  const {
    isConnected: dbConnected,
    error: dbError,
    loadProject: loadProjectFromDatabase,
    saveAsTemplate,
    trackProjectUsage,
  } = useDatabase();
  const tokens = getVisualEditorTokens();

  // Panel visibility states
  const [showUnifiedStudio, setShowUnifiedStudio] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showExporter, setShowExporter] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [showLivePreviewPanel, setShowLivePreviewPanel] = useState(false);
  const [showAdvancedWorkspace, setShowAdvancedWorkspace] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<AdvancedWorkspaceTab>('templates');
  const [showLibrarySuggestions, setShowLibrarySuggestions] = useState(false);
  const [suggestedComponentType, setSuggestedComponentType] = useState('video-player');
  const [showProfessionWizard, setShowProfessionWizard] = useState(false);
  const [logoManagerOpen, setLogoManagerOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'html' | 'react' | 'vue'>('react');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [integrationProjectId, setIntegrationProjectId] = useState('default-project');
  const [templateName, setTemplateName] = useState('My template name');
  const [lastIntegrationEvent, setLastIntegrationEvent] = useState('Idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedProjectForPanels = {
    id: state.currentProject?.id ?? 'visual-editor-project',
    name: state.currentProject?.name ?? 'Visual Editor Project',
  };

  // Generated code state
  const [generatedCode, setGeneratedCode] = useState({
    html: '',
    react: '',
    css: '',
    javascript: '',
  });

  // Update generated code when elements change
  useEffect(() => {
    if (state.elements) {
      // Generate code from current elements
      const code = generateCodeFromElements(state.elements);
      setGeneratedCode(code);
    }
  }, [state.elements]);

  const generateCodeFromElements = useCallback((elements: EditorElement[]) => {
    // Generate HTML
    let html = `<!DOCTYPE html>\n<html>\n<head><style>\n.container { position: relative; width: 100%; min-height: 100vh; }\n`;
    elements.forEach((element) => {
      html += `.el-${element.id} {\n  position: absolute;\n  left: ${element.x}px;\n  top: ${element.y}px;\n  width: ${element.width}px;\n  height: ${element.height}px;\n`;
      if (element.styles) {
        Object.entries(element.styles).forEach(([key, value]) => {
          if (value !== undefined) {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            html += `  ${cssKey}: ${String(value)};\n`;
          }
        });
      }
      html += `}\n`;
    });
    html += `</style></head>\n<body>\n<div class="container">\n`;
    elements.forEach((element) => {
      const text = typeof element.props?.text === 'string' ? element.props.text : '';
      html += `  <div class="el-${element.id}">${text}</div>\n`;
    });
    html += `</div>\n</body>\n</html>`;

    // Generate React code
    let react = `import React from 'react';\n\nexport default function GeneratedComponent() {\n  return (\n    <div className="container">\n`;
    elements.forEach((element) => {
      react += `      <div className="${element.type}" style={{ position: 'absolute', left: ${element.x}, top: ${element.y}, width: ${element.width}, height: ${element.height} }}>\n`;
      if (typeof element.props?.text === 'string') {
        react += `        ${element.props.text}\n`;
      }
      react += `      </div>\n`;
    });
    react += `    </div>\n  );\n}`;

    // Generate CSS
    let css = `.container {\n  position: relative;\n  width: 100%;\n  min-height: 100vh;\n}\n\n`;
    elements.forEach((element) => {
      css += `.${element.type} {\n`;
      if (element.styles) {
        Object.entries(element.styles).forEach(([key, value]) => {
          if (value !== undefined) {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            css += `  ${cssKey}: ${String(value)};\n`;
          }
        });
      }
      css += `}\n\n`;
    });

    // Generate JavaScript
    let javascript = `// Auto-generated event handlers\n`;
    elements.forEach((element) => {
      if (element.type === 'button') {
        javascript += `document.querySelector('.el-${element.id}')?.addEventListener('click', () => {\n  console.log('${String(element.props?.text ?? element.id)} clicked');\n});\n\n`;
      }
    });

    return { html, react, css, javascript };
  }, []);

  const callIfFunction = useCallback((candidate: unknown, ...args: unknown[]) => {
    if (typeof candidate === 'function') {
      (candidate as (...fnArgs: unknown[]) => unknown)(...args);
    }
  }, []);

  const toRecord = useCallback((value: unknown): Record<string, unknown> | null => {
    if (typeof value === 'object' && value !== null) {
      return value as Record<string, unknown>;
    }
    return null;
  }, []);

  const getIntegrationRecords = useCallback(() => ({
    communicationRecord: communication as unknown as Record<string, unknown>,
    integrationRecord: integration as unknown as Record<string, unknown>,
    dataFlowRecord: dataFlow as unknown as Record<string, unknown>,
  }), [communication, dataFlow, integration]);

  const notify = useCallback((
    type: 'info' | 'success' | 'warning' | 'error',
    title: string,
    message: string,
  ) => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: `notif-${Date.now()}`,
        type,
        title,
        message,
        timestamp: new Date(),
        read: false,
      },
    });
  }, [dispatch]);

  const updateAnyComponent = useCallback((targetComponent: string, action: string, data: Record<string, unknown>) => {
    const { communicationRecord, integrationRecord, dataFlowRecord } = getIntegrationRecords();

    callIfFunction(communicationRecord.sendMessage, {
      from: 'enhanced-visual-editor',
      to: targetComponent,
      type: action,
      data,
      priority: 'high',
    });
    callIfFunction(communicationRecord.sendBroadcast, `${targetComponent}:${action}`, data, 'enhanced-visual-editor', 'all');
    callIfFunction(integrationRecord.emit, `${targetComponent}:${action}`, data, 'enhanced-visual-editor', 'all');
    callIfFunction(dataFlowRecord.syncData, `${targetComponent}:${action}`, data, 'enhanced-visual-editor', 'all');
    callIfFunction(integrationRecord.executeAction, action, { target: targetComponent, data }, 'high', 'enhanced-visual-editor', 'all');
  }, [callIfFunction, getIntegrationRecords]);

  const getDataFromComponent = useCallback(async (targetComponent: string, dataKey: string) => {
    const { communicationRecord } = getIntegrationRecords();
    const sendMessage = communicationRecord.sendMessage;
    const onMessage = communicationRecord.onMessage;

    if (typeof sendMessage !== 'function' || typeof onMessage !== 'function') {
      return null;
    }

    return new Promise<Record<string, unknown> | null>((resolve) => {
      let finished = false;

      const finalize = (payload: Record<string, unknown> | null) => {
        if (finished) {
          return;
        }
        finished = true;
        resolve(payload);
      };

      const unsubscribeResult = (onMessage as (handler: (message: Record<string, unknown>) => void) => unknown)((message) => {
        const from = message.from;
        const type = message.type;
        if (from === targetComponent && type === `${dataKey}:response`) {
          const data = message.data;
          if (typeof data === 'object' && data !== null) {
            finalize(data as Record<string, unknown>);
          } else {
            finalize(null);
          }
        }
      });

      (sendMessage as (message: Record<string, unknown>) => unknown)({
        from: 'enhanced-visual-editor',
        to: targetComponent,
        type: `${dataKey}:request`,
        data: { requestId: Date.now() },
        priority: 'medium',
      });

      setTimeout(() => {
        if (typeof unsubscribeResult === 'function') {
          (unsubscribeResult as () => void)();
        }
        finalize(null);
      }, 2000);
    });
  }, [getIntegrationRecords]);

  const workspaceAction = useCallback((panel: string, action: string) => {
    notify('info', `${panel} action`, action);
    updateAnyComponent(panel.toLowerCase().replace(/\s+/g, '-'), action.toLowerCase().replace(/\s+/g, '-'), {
      panel,
      action,
      timestamp: Date.now(),
    });
  }, [notify, updateAnyComponent]);

  const isVisualEditorProject = useCallback((candidate: unknown): candidate is Project => {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }
    const candidateRecord = candidate as Record<string, unknown>;
    if (typeof candidateRecord.id !== 'string' || typeof candidateRecord.name !== 'string') {
      return false;
    }
    if (!Array.isArray(candidateRecord.elements)) {
      return false;
    }
    if (typeof candidateRecord.settings !== 'object' || candidateRecord.settings === null) {
      return false;
    }
    if (typeof candidateRecord.metadata !== 'object' || candidateRecord.metadata === null) {
      return false;
    }
    const status = candidateRecord.status;
    return status === 'draft' || status === 'review' || status === 'published' || status === 'archived';
  }, []);

  const handlePanelProjectUpdate = useCallback((project: Record<string, unknown>) => {
    if (isVisualEditorProject(project)) {
      loadProject(project);
      notify('success', 'Project Synced', `Loaded project ${project.name} from advanced panel`);
      return;
    }
    notify('info', 'Project Update', 'Panel sent update payload');
  }, [isVisualEditorProject, loadProject, notify]);

  const handlePanelNotification = useCallback((notification: Record<string, unknown>) => {
    const title = typeof notification.title === 'string' ? notification.title : 'Panel Notification';
    const message = typeof notification.message === 'string' ? notification.message : 'Action completed';
    const type = notification.type;
    if (type === 'success' || type === 'warning' || type === 'error' || type === 'info') {
      notify(type, title, message);
      return;
    }
    notify('info', title, message);
  }, [notify]);

  const handleEnableFeatures = useCallback((featureIds: string[]) => {
    const normalized = featureIds
      .map((featureId) => featureId.trim())
      .filter((featureId) => featureId.length > 0);

    const storageKey = 'visual-editor:enabled-features';
    let mergedFeatures = normalized;
    try {
      const raw = localStorage.getItem(storageKey);
      const existing = raw ? JSON.parse(raw) : [];
      if (Array.isArray(existing)) {
        const existingFeatures = existing.filter((item): item is string => typeof item === 'string');
        mergedFeatures = Array.from(new Set([...existingFeatures, ...normalized]));
      }
      localStorage.setItem(storageKey, JSON.stringify(mergedFeatures));
    } catch {
      localStorage.setItem(storageKey, JSON.stringify(normalized));
    }

    notify(
      'success',
      'Features Enabled',
      mergedFeatures.length > 0
        ? `Enabled ${mergedFeatures.length} feature flags for this workspace`
        : 'No new features were selected',
    );
  }, [notify]);

  const handleSaveProfession = useCallback((config: ProfessionConfiguration) => {
    const storageKey = 'visual-editor:profession-configs';
    try {
      const raw = localStorage.getItem(storageKey);
      const existing = raw ? JSON.parse(raw) : {};
      const existingRecord = typeof existing === 'object' && existing !== null
        ? (existing as Record<string, unknown>)
        : {};
      const nextRecord: Record<string, unknown> = { ...existingRecord, [config.professionId]: config };
      localStorage.setItem(storageKey, JSON.stringify(nextRecord));
      notify('success', 'Profession Saved', `${config.displayName} was saved to local workspace profiles`);
    } catch {
      notify('error', 'Save Failed', 'Could not persist profession configuration');
    }
  }, [notify]);

  const openSmartSuggestions = useCallback((componentType: string) => {
    setSuggestedComponentType(componentType);
    setShowLibrarySuggestions(true);
  }, []);

  const handleLoadProjectFromDb = useCallback(async () => {
    if (!dbConnected) {
      notify('warning', 'Database Offline', 'Database connection is not available');
      return;
    }
    const projectId = state.currentProject?.id;
    if (!projectId) {
      notify('warning', 'No Project', 'No active project id to load from database');
      return;
    }

    try {
      const loaded = await loadProjectFromDatabase(projectId);
      if (loaded && isVisualEditorProject(loaded)) {
        loadProject(loaded);
        notify('success', 'Project Loaded', `Loaded ${loaded.name} from database`);
      } else {
        notify('warning', 'Load Skipped', 'Database returned no compatible project payload');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load project';
      notify('error', 'Load Failed', message);
    }
  }, [dbConnected, isVisualEditorProject, loadProject, loadProjectFromDatabase, notify, state.currentProject?.id]);

  const handleSaveCurrentAsTemplate = useCallback(async () => {
    if (!dbConnected) {
      notify('warning', 'Database Offline', 'Cannot save template while database is disconnected');
      return;
    }

    const projectToSave: Project = state.currentProject ?? {
      id: selectedProjectForPanels.id,
      name: selectedProjectForPanels.name,
      elements: state.elements,
      settings: {
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff',
        gridSize: 10,
        snapToGrid: true,
      },
      metadata: {
        createdBy: 'local-user',
        createdAt: new Date(),
        lastModified: new Date(),
        version: 1,
      },
      status: 'draft',
    };

    try {
      await saveAsTemplate(projectToSave, `${projectToSave.name}-template`);
      await trackProjectUsage(projectToSave.id, 'template_saved', { source: 'enhanced-visual-editor' });
      notify('success', 'Template Saved', `Saved ${projectToSave.name} as template`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save template';
      notify('error', 'Template Save Failed', message);
    }
  }, [
    dbConnected,
    notify,
    saveAsTemplate,
    selectedProjectForPanels.id,
    selectedProjectForPanels.name,
    state.currentProject,
    state.elements,
    trackProjectUsage,
  ]);

  const handleProbeAdminData = useCallback(async () => {
    const data = await getDataFromComponent('admin-dashboard', 'selectedUser');
    if (data) {
      notify('info', 'Admin Data', 'Received admin payload response');
      return;
    }
    notify('warning', 'No Admin Data', 'No response from admin-dashboard');
  }, [getDataFromComponent, notify]);

  const triggerComponentAction = useCallback((targetComponent: string, action: string, ...args: unknown[]) => {
    const { communicationRecord, integrationRecord } = getIntegrationRecords();
    callIfFunction(integrationRecord.executeAction, action, { target: targetComponent, args }, 'high', 'enhanced-visual-editor', 'all');
    callIfFunction(communicationRecord.sendMessage, {
      from: 'enhanced-visual-editor',
      to: targetComponent,
      type: `action:${action}`,
      data: { args },
      priority: 'high',
    });
    callIfFunction(integrationRecord.emit, `${targetComponent}:action:${action}`, { args }, 'enhanced-visual-editor', 'all');
    setLastIntegrationEvent(`Triggered action ${action} on ${targetComponent}`);
  }, [callIfFunction, getIntegrationRecords]);

  const getIntegrationSnapshot = useCallback((): IntegrationStateSnapshot => ({
    projectId: selectedProjectForPanels.id,
    projectName: selectedProjectForPanels.name,
    elements: state.elements,
    activeTab: activeWorkspaceTab,
    timestamp: Date.now(),
  }), [activeWorkspaceTab, selectedProjectForPanels.id, selectedProjectForPanels.name, state.elements]);

  const syncIntegrationState = useCallback((reason: string) => {
    const snapshot = getIntegrationSnapshot();
    const { communicationRecord, integrationRecord, dataFlowRecord } = getIntegrationRecords();
    callIfFunction(
      communicationRecord.sendBroadcast,
      'visual-editor:state-synced',
      { reason, snapshot },
      'enhanced-visual-editor',
      'all',
    );
    callIfFunction(
      integrationRecord.emit,
      'visual-editor:state-synced',
      { reason, snapshot },
      'enhanced-visual-editor',
      'all',
    );
    callIfFunction(
      dataFlowRecord.syncData,
      'visual-editor:project-state',
      snapshot,
      'enhanced-visual-editor',
      'all',
    );
    setLastSyncedAt(snapshot.timestamp);
    setLastIntegrationEvent(`Synced: ${reason}`);
  }, [callIfFunction, getIntegrationRecords, getIntegrationSnapshot]);

  const handleSyncProjectChanges = useCallback((changes: Record<string, unknown>) => {
    const snapshot = getIntegrationSnapshot();
    updateAnyComponent('project-sync', 'changes', {
      projectId: snapshot.projectId,
      changes,
      timestamp: Date.now(),
    });
    syncIntegrationState('project-changes');
    setLastIntegrationEvent('Project changes synced');
  }, [getIntegrationSnapshot, syncIntegrationState, updateAnyComponent]);

  const handleOpenScrollStories = useCallback(() => {
    setShowLivePreviewPanel(true);
    updateAnyComponent('scroll-stories', 'open', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleOpenAssetLibrary = useCallback(() => {
    setShowComponentLibrary(true);
    updateAnyComponent('asset-library', 'open', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleOpenQualityAnalysis = useCallback(() => {
    setShowAccessibility(true);
    updateAnyComponent('quality-analysis', 'run', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleOpenGoogleServices = useCallback(() => {
    setShowSettings(true);
    setShowAdvancedWorkspace(true);
    setActiveWorkspaceTab('cloud-sync');
    updateAnyComponent('google-services', 'open', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleOpenNoteEditor = useCallback(() => {
    setShowCodeEditor(true);
    updateAnyComponent('note-editor', 'open', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleOpenSEODashboard = useCallback(() => {
    setShowAdvancedWorkspace(true);
    setActiveWorkspaceTab('seo');
    updateAnyComponent('seo-dashboard', 'open', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleLoadProjectById = useCallback(async (projectId: string) => {
    if (!dbConnected) {
      notify('warning', 'Database Offline', 'Cannot load project while database is disconnected');
      return;
    }
    try {
      const loaded = await loadProjectFromDatabase(projectId);
      if (loaded && isVisualEditorProject(loaded)) {
        loadProject(loaded);
        notify('success', 'Project Loaded', `Loaded ${loaded.name}`);
        syncIntegrationState('manual-project-load');
      } else {
        notify('warning', 'Project Not Found', `No compatible project for id ${projectId}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load project';
      notify('error', 'Load Failed', message);
    }
  }, [dbConnected, isVisualEditorProject, loadProject, loadProjectFromDatabase, notify, syncIntegrationState]);

  const handleSaveAsTemplateByName = useCallback(async (name: string) => {
    setTemplateName(name);
    if (!dbConnected) {
      notify('warning', 'Database Offline', 'Cannot save template while database is disconnected');
      return;
    }

    const projectToSave: Project = state.currentProject ?? {
      id: selectedProjectForPanels.id,
      name: selectedProjectForPanels.name,
      elements: state.elements,
      settings: {
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff',
        gridSize: 10,
        snapToGrid: true,
      },
      metadata: {
        createdBy: 'local-user',
        createdAt: new Date(),
        lastModified: new Date(),
        version: 1,
      },
      status: 'draft',
    };

    try {
      await saveAsTemplate(projectToSave, name);
      await trackProjectUsage(projectToSave.id, 'template_saved', { source: 'enhanced-visual-editor', templateName: name });
      notify('success', 'Template Saved', `Saved template ${name}`);
      syncIntegrationState('manual-template-save');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save template';
      notify('error', 'Template Save Failed', message);
    }
  }, [
    dbConnected,
    notify,
    saveAsTemplate,
    selectedProjectForPanels.id,
    selectedProjectForPanels.name,
    state.currentProject,
    state.elements,
    syncIntegrationState,
    trackProjectUsage,
  ]);

  const handleBroadcastCursorPosition = useCallback((position: { x: number; y: number }) => {
    const { communicationRecord } = getIntegrationRecords();
    callIfFunction(
      communicationRecord.sendBroadcast,
      'visual-editor:cursor:update',
      {
        userId: 'local-user',
        cursor: position,
        timestamp: Date.now(),
      },
      'enhanced-visual-editor',
      'all',
    );
    setLastIntegrationEvent(`Broadcast cursor (${position.x}, ${position.y})`);
  }, [callIfFunction, getIntegrationRecords]);

  useEffect(() => {
    const { communicationRecord, dataFlowRecord } = getIntegrationRecords();
    callIfFunction(
      communicationRecord.registerComponent,
      'enhanced-visual-editor',
      'visual-editor',
      ['data:read', 'data:write', 'event:emit', 'event:listen', 'action:execute', 'ui:update'],
    );
    callIfFunction(
      dataFlowRecord.registerNode,
      'source',
      'enhanced-visual-editor',
      'visual-editor:project-state',
      (data: Record<string, unknown>) => ({ ...data, lastUpdated: Date.now() }),
    );
    setLastIntegrationEvent('Registered with integration system');

    const onMessage = communicationRecord.onMessage;
    let unsubscribeResult: unknown;
    if (typeof onMessage === 'function') {
      unsubscribeResult = (onMessage as (handler: (message: IntegrationMessage) => void) => unknown)((message) => {
        const type = typeof message.type === 'string' ? message.type : '';
        const dataRecord = toRecord(message.data);
        if (!dataRecord) {
          return;
        }

        if (type === 'project:selected' && isVisualEditorProject(dataRecord)) {
          loadProject(dataRecord);
          notify('info', 'Project Selected', `Loaded ${dataRecord.name}`);
          setLastIntegrationEvent('Loaded project:selected event');
          return;
        }

        if (type === 'data:sync') {
          const dataKey = dataRecord.dataKey;
          const payload = dataRecord.data;
          if (dataKey === 'visual-editor:project' && isVisualEditorProject(payload)) {
            loadProject(payload);
            notify('info', 'Project Synced', `Loaded ${payload.name} from synced payload`);
            setLastIntegrationEvent('Loaded data:sync payload');
            return;
          }
        }

        if (type === 'new-components-available') {
          setShowComponentLibrary(true);
          notify('success', 'New Components', 'Generated components are ready in library');
          setLastIntegrationEvent('Received new-components-available');
          return;
        }

        if (type === 'code-generation:complete') {
          notify('success', 'Code Generation', 'Code generation completed and synced');
          setLastIntegrationEvent('Received code-generation:complete');
        }
      });
    }

    return () => {
      if (typeof unsubscribeResult === 'function') {
        (unsubscribeResult as () => void)();
      }
      callIfFunction(communicationRecord.unregisterComponent, 'enhanced-visual-editor');
      setLastIntegrationEvent('Unregistered from integration system');
    };
  }, [
    callIfFunction,
    getIntegrationRecords,
    isVisualEditorProject,
    loadProject,
    notify,
    toRecord,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      syncIntegrationState('state-change');
    }, 250);
    return () => clearTimeout(timer);
  }, [activeWorkspaceTab, state.elements, syncIntegrationState]);

  useEffect(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    autoSaveIntervalRef.current = setInterval(() => {
      if (!state.currentProject) {
        return;
      }

      saveProject();
      syncIntegrationState('autosave');

      if (dbConnected) {
        trackProjectUsage(state.currentProject.id, 'autosave', {
          source: 'enhanced-visual-editor',
          elementCount: state.elements.length,
        }).catch(() => {
          notify('warning', 'Autosave Metrics', 'Project saved but usage metric failed');
        });
      }
    }, 30000);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    };
  }, [
    dbConnected,
    notify,
    saveProject,
    state.currentProject,
    state.elements.length,
    syncIntegrationState,
    trackProjectUsage,
  ]);

  const renderAdvancedWorkspace = useCallback(() => {
    switch (activeWorkspaceTab) {
      case 'templates':
        return (
          <TemplateDashboard
            onTemplatesClick={() => workspaceAction('Templates', 'Open templates')}
            onCategoriesClick={() => workspaceAction('Templates', 'Open categories')}
            onSearchClick={() => workspaceAction('Templates', 'Open search')}
            onPreviewClick={() => workspaceAction('Templates', 'Open preview')}
          />
        );
      case 'export-presets':
        return (
          <ExportPresetsDashboard
            onPresetsClick={() => workspaceAction('Export Presets', 'Open presets')}
            onPlatformsClick={() => workspaceAction('Export Presets', 'Open platforms')}
            onFormatsClick={() => workspaceAction('Export Presets', 'Open formats')}
            onPreviewClick={() => workspaceAction('Export Presets', 'Open preview')}
          />
        );
      case 'cloud-sync':
        return (
          <CloudSyncDashboard
            onProvidersClick={() => workspaceAction('Cloud Sync', 'Open providers')}
            onBackupsClick={() => workspaceAction('Cloud Sync', 'Open backups')}
            onSyncClick={() => workspaceAction('Cloud Sync', 'Start sync')}
            onConflictsClick={() => workspaceAction('Cloud Sync', 'Open conflicts')}
          />
        );
      case 'team-collaboration':
        return (
          <TeamCollaborationDashboard
            onSettingsClick={() => workspaceAction('Team Collaboration', 'Open settings')}
            onMembersClick={() => workspaceAction('Team Collaboration', 'Open members')}
            onWorkloadClick={() => workspaceAction('Team Collaboration', 'Open workload')}
            onSessionsClick={() => workspaceAction('Team Collaboration', 'Open sessions')}
            onMobileClick={() => workspaceAction('Team Collaboration', 'Open mobile tools')}
            onAnalyticsClick={() => workspaceAction('Team Collaboration', 'Open analytics')}
          />
        );
      case 'plugins':
        return (
          <PluginDashboard
            onHooksClick={() => workspaceAction('Plugins', 'Open hooks')}
            onComponentsClick={() => workspaceAction('Plugins', 'Open components')}
            onUtilitiesClick={() => workspaceAction('Plugins', 'Open utilities')}
            onThemesClick={() => workspaceAction('Plugins', 'Open themes')}
            onIntegrationsClick={() => workspaceAction('Plugins', 'Open integrations')}
          />
        );
      case 'animations':
        return (
          <AnimationDashboard
            onAnimationsClick={() => workspaceAction('Animations', 'Open animation list')}
            onTimelineClick={() => workspaceAction('Animations', 'Open timeline')}
            onKeyframesClick={() => workspaceAction('Animations', 'Open keyframes')}
            onPreviewClick={() => workspaceAction('Animations', 'Open preview')}
          />
        );
      case 'component-library':
        return (
          <ComponentLibraryDashboard
            onComponentsClick={() => workspaceAction('Component Library', 'Open components')}
            onCategoriesClick={() => workspaceAction('Component Library', 'Open categories')}
            onTagsClick={() => workspaceAction('Component Library', 'Open tags')}
            onDocumentationClick={() => workspaceAction('Component Library', 'Open docs')}
          />
        );
      case 'design-system':
        return (
          <DesignSystemDashboard
            onTokensClick={() => workspaceAction('Design System', 'Open tokens')}
            onGuidelinesClick={() => workspaceAction('Design System', 'Open guidelines')}
            onThemesClick={() => workspaceAction('Design System', 'Open themes')}
            onDocumentationClick={() => workspaceAction('Design System', 'Open docs')}
          />
        );
      case 'analytics':
        return (
          <AnalyticsDashboard
            onSettingsClick={() => workspaceAction('Analytics', 'Open settings')}
            onExportClick={() => workspaceAction('Analytics', 'Export report')}
          />
        );
      case 'audit':
        return (
          <AuditDashboard
            onSettingsClick={() => workspaceAction('Audit', 'Open settings')}
            onManagementClick={() => workspaceAction('Audit', 'Open management')}
            onMonitoringClick={() => workspaceAction('Audit', 'Open monitoring')}
            onEventsClick={() => workspaceAction('Audit', 'Open events')}
            onStatsClick={() => workspaceAction('Audit', 'Open stats')}
            onAlertsClick={() => workspaceAction('Audit', 'Open alerts')}
            onExportClick={() => workspaceAction('Audit', 'Export logs')}
          />
        );
      case 'monitoring':
        return (
          <MonitoringDashboard
            onSettingsClick={() => workspaceAction('Monitoring', 'Open settings')}
            onAlertsClick={() => workspaceAction('Monitoring', 'Open alerts')}
            onMetricsClick={() => workspaceAction('Monitoring', 'Open metrics')}
            onPerformanceClick={() => workspaceAction('Monitoring', 'Open performance')}
            onCachingClick={() => workspaceAction('Monitoring', 'Open cache metrics')}
            onSystemClick={() => workspaceAction('Monitoring', 'Open system')}
          />
        );
      case 'system-management':
        return (
          <SystemManagementDashboard
            onSettingsClick={() => workspaceAction('System Management', 'Open settings')}
            onAlertsClick={() => workspaceAction('System Management', 'Open alerts')}
            onMetricsClick={() => workspaceAction('System Management', 'Open metrics')}
            onScalingClick={() => workspaceAction('System Management', 'Open scaling')}
            onBackupClick={() => workspaceAction('System Management', 'Open backups')}
            onRecoveryClick={() => workspaceAction('System Management', 'Open recovery')}
          />
        );
      case 'ml-optimization':
        return (
          <MLOptimizationDashboard
            onSettingsClick={() => workspaceAction('ML Optimization', 'Open settings')}
            onModelsClick={() => workspaceAction('ML Optimization', 'Open models')}
            onPredictionsClick={() => workspaceAction('ML Optimization', 'Open predictions')}
            onOptimizationsClick={() => workspaceAction('ML Optimization', 'Open optimizations')}
            onAnalyticsClick={() => workspaceAction('ML Optimization', 'Open analytics')}
            onTrainingClick={() => workspaceAction('ML Optimization', 'Start training')}
          />
        );
      case 'advanced-analytics':
        return (
          <AdvancedAnalyticsDashboard
            onSettingsClick={() => workspaceAction('Advanced Analytics', 'Open settings')}
            onHeatmapsClick={() => workspaceAction('Advanced Analytics', 'Open heatmaps')}
            onBehaviorClick={() => workspaceAction('Advanced Analytics', 'Open behavior')}
            onFunnelsClick={() => workspaceAction('Advanced Analytics', 'Open funnels')}
            onTestsClick={() => workspaceAction('Advanced Analytics', 'Open tests')}
            onInsightsClick={() => workspaceAction('Advanced Analytics', 'Open insights')}
          />
        );
      case 'ai-assistance':
        return (
          <AIAssistanceDashboard
            onSettingsClick={() => workspaceAction('AI Assistance', 'Open settings')}
            onSuggestionsClick={() => workspaceAction('AI Assistance', 'Open suggestions')}
            onConversationsClick={() => workspaceAction('AI Assistance', 'Open conversations')}
            onCodeGenerationClick={() => workspaceAction('AI Assistance', 'Generate code')}
            onDesignSuggestionsClick={() => workspaceAction('AI Assistance', 'Generate design suggestions')}
            onWorkflowsClick={() => workspaceAction('AI Assistance', 'Open workflows')}
          />
        );
      case 'templates-presets':
      case 'template-presets':
        return (
          <TemplatePresetDashboard
            onSettingsClick={() => workspaceAction('Template Presets', 'Open settings')}
            onTemplatesClick={() => workspaceAction('Template Presets', 'Open templates')}
            onPresetsClick={() => workspaceAction('Template Presets', 'Open presets')}
            onCategoriesClick={() => workspaceAction('Template Presets', 'Open categories')}
            onImportClick={() => workspaceAction('Template Presets', 'Import preset')}
            onExportClick={() => workspaceAction('Template Presets', 'Export preset')}
          />
        );
      case 'client-communication':
        return (
          <ClientCommunicationDashboard
            onSettingsClick={() => workspaceAction('Client Communication', 'Open settings')}
            onTemplatesClick={() => workspaceAction('Client Communication', 'Open templates')}
            onSegmentsClick={() => workspaceAction('Client Communication', 'Open segments')}
            onAutomationClick={() => workspaceAction('Client Communication', 'Open automation')}
            onAnalyticsClick={() => workspaceAction('Client Communication', 'Open analytics')}
            onDeadlinesClick={() => workspaceAction('Client Communication', 'Open deadlines')}
          />
        );
      case 'revenue-optimization':
        return (
          <RevenueOptimizationDashboard
            onSettingsClick={() => workspaceAction('Revenue Optimization', 'Open settings')}
            onPricingClick={() => workspaceAction('Revenue Optimization', 'Open pricing')}
            onUpsellingClick={() => workspaceAction('Revenue Optimization', 'Open upselling')}
            onForecastingClick={() => workspaceAction('Revenue Optimization', 'Open forecasting')}
            onAnalysisClick={() => workspaceAction('Revenue Optimization', 'Open analysis')}
            onMarketRatesClick={() => workspaceAction('Revenue Optimization', 'Open market rates')}
          />
        );
      case 'seo':
        return (
          <SEODashboard
            onCrawlClick={() => workspaceAction('SEO', 'Start crawl')}
            onAnalyzeClick={() => workspaceAction('SEO', 'Open analysis')}
            onKeywordsClick={() => workspaceAction('SEO', 'Open keywords')}
            onCompetitorsClick={() => workspaceAction('SEO', 'Open competitors')}
            onSchemaClick={() => workspaceAction('SEO', 'Open schema')}
            onReportsClick={() => workspaceAction('SEO', 'Open reports')}
            onSettingsClick={() => workspaceAction('SEO', 'Open settings')}
          />
        );
      case 'modals':
        return (
          <ModalCreator
            selectedProject={selectedProjectForPanels}
            onProjectUpdate={handlePanelProjectUpdate}
            onNotificationCreate={handlePanelNotification}
          />
        );
      case 'dashboard-components':
        return (
          <DashboardComponentManager
            selectedProject={selectedProjectForPanels}
            onProjectUpdate={handlePanelProjectUpdate}
            onNotificationCreate={handlePanelNotification}
            profession="admin"
          />
        );
      case 'toasts':
        return <ToastDesigner />;
      case 'branding':
        return (
          <BrandingWorkflowPanel
            onBrandingApplied={(branding) => {
              const appliedName = typeof branding.name === 'string' ? branding.name : 'custom branding';
              notify('success', 'Branding Applied', `Applied ${appliedName}`);
            }}
            onNotification={(notification) => {
              const level = notification.type;
              if (level === 'success' || level === 'warning' || level === 'error' || level === 'info') {
                notify(level, notification.title, notification.message);
                return;
              }
              notify('info', notification.title, notification.message);
            }}
          />
        );
      case 'landing-settings':
        return <LandingSettingsPanel />;
      case 'showcase-publisher':
        return <ShowcasePublisherPanel userId="local-user" />;
      case 'theming-admin':
        return <ThemingAdminPanel />;
      case 'integration-tools':
        return (
          <Box sx={{ p: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Integration Tools
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                label="Project Id"
                value={integrationProjectId}
                onChange={(event) => setIntegrationProjectId(event.target.value)}
              />
              <Button variant="outlined" onClick={() => void handleLoadProjectById(integrationProjectId)}>
                Load Project
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                label="Template Name"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
              />
              <Button variant="outlined" onClick={() => void handleSaveAsTemplateByName(templateName)}>
                Save Template
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap">
              <Button variant="outlined" onClick={() => updateAnyComponent('admin-dashboard', 'refresh', { source: 'enhanced-visual-editor' })}>
                Refresh Admin
              </Button>
              <Button variant="outlined" onClick={() => updateAnyComponent('analytics-panel', 'track', { event: 'element_created', count: state.elements.length })}>
                Track Analytics
              </Button>
              <Button variant="outlined" onClick={() => triggerComponentAction('notification-widget', 'show', { message: 'Project updated', type: 'success' })}>
                Notify
              </Button>
              <Button variant="outlined" onClick={() => updateAnyComponent('client-portal', 'updateProject', { projectId: selectedProjectForPanels.id })}>
                Sync Client Portal
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap">
              <Button variant="outlined" onClick={() => void handleProbeAdminData()}>
                Probe Admin Data
              </Button>
              <Button variant="outlined" onClick={() => handleBroadcastCursorPosition({ x: 100, y: 200 })}>
                Broadcast Cursor
              </Button>
              <Button variant="outlined" onClick={handleOpenSEODashboard}>
                Open SEO
              </Button>
              <Button variant="outlined" onClick={handleOpenQualityAnalysis}>
                Quality Analysis
              </Button>
              <Button variant="outlined" onClick={handleOpenAssetLibrary}>
                Open Asset Library
              </Button>
              <Button variant="outlined" onClick={handleOpenScrollStories}>
                Open Scroll Stories
              </Button>
              <Button variant="outlined" onClick={handleOpenGoogleServices}>
                Open Google Services
              </Button>
              <Button variant="outlined" onClick={handleOpenNoteEditor}>
                Open Note Editor
              </Button>
            </Stack>
            <Button
              variant="contained"
              onClick={() => handleSyncProjectChanges({ elements: state.elements, activeTab: activeWorkspaceTab })}
            >
              Sync Project Changes
            </Button>
          </Box>
        );
      default:
        return null;
    }
  }, [
    activeWorkspaceTab,
    handleBroadcastCursorPosition,
    handleLoadProjectById,
    handleOpenAssetLibrary,
    handleOpenGoogleServices,
    handleOpenNoteEditor,
    handleOpenQualityAnalysis,
    handleOpenScrollStories,
    handleOpenSEODashboard,
    handlePanelNotification,
    handlePanelProjectUpdate,
    notify,
    integrationProjectId,
    state.elements,
    selectedProjectForPanels,
    templateName,
    triggerComponentAction,
    handleProbeAdminData,
    handleSaveAsTemplateByName,
    handleSyncProjectChanges,
    updateAnyComponent,
    workspaceAction,
  ]);

  const handleCommandExecute = useCallback((commandId: string) => {
    switch (commandId) {
      case 'save':
        saveProject();
        break;
      case 'export': setShowExporter(true);
        break;
      case 'accessibility-check': setShowAccessibility(true);
        break;
      case 'format-code': {
        // Re-generate code from current elements to get a clean formatted version
        const freshCode = generateCodeFromElements(state.elements);
        setGeneratedCode(freshCode);
        break;
      }
      case 'refresh-preview': setShowLivePreview(false);
        setTimeout(() => setShowLivePreview(true), 100);
        break;
      case 'export-html': setExportFormat('html');
        setShowExporter(true);
        break;
      case 'export-react': setExportFormat('react');
        setShowExporter(true);
        break;
      case 'export-vue': setExportFormat('vue');
        setShowExporter(true);
        break;
      case 'toggle-format': 
        setExportFormat(prev => {
          if (prev === 'html') return 'react';
          if (prev === 'react') return 'vue';
          return 'html';
        });
        break;
      case 'toggle-code-editor': setShowCodeEditor(prev => !prev);
        break;
      case 'toggle-preview': setShowLivePreviewPanel(prev => !prev);
        break;
      case 'toggle-settings': setShowSettings(prev => !prev);
        setShowAdvancedWorkspace(true);
        setActiveWorkspaceTab('system-management');
        break;
      default: break;
    }
  }, [saveProject, generateCodeFromElements, state.elements]);

  const handleUseComponent = useCallback((component: LibraryComponent) => {
    dispatch({
      type: 'ADD_ELEMENT',
      payload: {
        id: `component-${Date.now()}`,
        type: toElementType(component.category ?? 'container'),
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        styles: {},
        props: { ...(component.props ?? {}) },
      },
    });
    setShowComponentLibrary(false);
  }, [dispatch]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Cmd/Ctrl + E for export
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setShowExporter(true);
      }

      // Cmd/Ctrl + Shift + A for accessibility
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setShowAccessibility(true);
      }

      // Cmd/Ctrl + Shift + C for unified code studio
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        setShowUnifiedStudio(!showUnifiedStudio);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUnifiedStudio]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <EnhancedTopToolbar />

      {/* Main Editor Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Component Library */}
        <VisualEditorSidebar
          onClientSelect={(clientId) => {
            dispatch({ type: 'ADD_NOTIFICATION', payload: { id: `notif-${Date.now()}`, type: 'info', title: 'Client Selected', message: `Client selected: ${clientId}`, timestamp: new Date(), read: false } });
          }}
          onComponentDrag={(componentType) => {
            dispatch({ type: 'ADD_NOTIFICATION', payload: { id: `notif-${Date.now()}`, type: 'info', title: 'Component Drag', message: `Dragging: ${componentType}`, timestamp: new Date(), read: false } });
            updateAnyComponent('component-library', 'drag-start', { componentType, timestamp: Date.now() });
          }}
          onComponentAdd={(componentType, position) => {
            const elementId = `component-${Date.now()}`;
            dispatch({
              type: 'ADD_ELEMENT',
              payload: {
                id: elementId,
                type: toElementType(componentType),
                x: position.x,
                y: position.y,
                width: 200,
                height: 100,
                styles: {},
                props: {},
              },
            });
            updateAnyComponent('timeline', 'element-added', {
              id: elementId,
              componentType,
              position,
              timestamp: Date.now(),
            });
          }}
          searchQuery={sidebarSearch}
          onSearchChange={setSidebarSearch}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onOpenAssetLibrary={handleOpenAssetLibrary}
          onOpenScrollStories={handleOpenScrollStories}
          onOpenGoogleServices={handleOpenGoogleServices}
          onOpenNoteEditor={handleOpenNoteEditor}
          onOpenSettings={handleOpenGoogleServices}
        />

        {/* Canvas Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'}}>
          <FabricCanvas />

          {/* Floating Action Buttons */}
          <Box
            sx={{
              position: 'absolute',
              right: 16,
              bottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              zIndex: 100}}>
            <Tooltip title={tokens.enhancedPage.fabs.unifiedStudio} placement="left">
              <Fab
                size="small"
                color={showUnifiedStudio ? 'primary' : 'default'}
                onClick={() => setShowUnifiedStudio(!showUnifiedStudio)}
              >
                <Code />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.accessibility} placement="left">
              <Fab
                size="small"
                color={showAccessibility ? 'primary' : 'default'}
                onClick={() => setShowAccessibility(!showAccessibility)}
              >
                <Accessible />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.exportPanel} placement="left">
              <Fab size="small" onClick={() => setShowExporter(true)}>
                <CloudUpload />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.componentLibrary} placement="left">
              <Fab
                size="small"
                color={showComponentLibrary ? 'primary' : 'default'}
                onClick={() => setShowComponentLibrary(!showComponentLibrary)}
              >
                <Folder />
              </Fab>
            </Tooltip>

            <Tooltip title="Advanced Workspace" placement="left">
              <Fab
                size="small"
                color={showAdvancedWorkspace ? 'primary' : 'default'}
                onClick={() => setShowAdvancedWorkspace((prev) => !prev)}
              >
                <DashboardCustomize />
              </Fab>
            </Tooltip>

            <Tooltip title="Smart Library Suggestions" placement="left">
              <Fab
                size="small"
                color={showLibrarySuggestions ? 'primary' : 'default'}
                onClick={() => openSmartSuggestions('video-player')}
              >
                <AutoAwesome />
              </Fab>
            </Tooltip>

            <Tooltip title="Profession Config Wizard" placement="left">
              <Fab
                size="small"
                color={showProfessionWizard ? 'primary' : 'default'}
                onClick={() => setShowProfessionWizard(true)}
              >
                <Tune />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.shortcuts} placement="left">
              <Fab size="small" onClick={() => setShowShortcuts(true)}>
                <Keyboard />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.codeEditor} placement="left">
              <Fab
                size="small"
                color={showCodeEditor ? 'primary' : 'default'}
                onClick={() => setShowCodeEditor(!showCodeEditor)}
              >
                <Code />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.livePreviewPanel} placement="left">
              <Fab
                size="small"
                color={showLivePreviewPanel ? 'primary' : 'default'}
                onClick={() => setShowLivePreviewPanel(!showLivePreviewPanel)}
              >
                <Visibility />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.previewMode} placement="left">
              <Fab
                size="small"
                color={showLivePreview ? 'primary' : 'default'}
                onClick={() => setShowLivePreview(!showLivePreview)}
              >
                <Visibility />
              </Fab>
            </Tooltip>

            <Tooltip title={tokens.enhancedPage.fabs.settings} placement="left">
              <IconButton
                size="small"
                color={showSettings ? 'primary' : 'default'}
                onClick={() => {
                  setShowSettings((prev) => !prev);
                  setShowAdvancedWorkspace(true);
                  setActiveWorkspaceTab('system-management');
                }}
                sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Right Properties Panel */}
        <EnhancedPropertiesPanel />
      </Box>

      {/* Advanced Workspace Drawer */}
      <Drawer
        anchor="bottom"
        open={showAdvancedWorkspace}
        onClose={() => setShowAdvancedWorkspace(false)}
        variant="persistent"
        PaperProps={{
          sx: {
            height: '48vh',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            borderTop: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box
            sx={{
              px: 2,
              py: 1,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Advanced Workspace
              </Typography>
              <Typography variant="caption" color={dbConnected ? 'success.main' : 'warning.main'}>
                {dbConnected ? 'Database connected' : 'Database disconnected'}
              </Typography>
              {dbError && (
                <Typography variant="caption" color="error.main">
                  {dbError}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {lastIntegrationEvent}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {lastSyncedAt ? `Last sync: ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Last sync: never'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, pt: 0.5 }}>
                <Fab
                  size="small"
                  onClick={handleLoadProjectFromDb}
                  title="Load current project from database"
                >
                  <CloudUpload />
                </Fab>
                <Fab
                  size="small"
                  onClick={handleSaveCurrentAsTemplate}
                  title="Save current project as template"
                >
                  <Folder />
                </Fab>
                <Fab
                  size="small"
                  onClick={handleProbeAdminData}
                  title="Probe admin component data"
                >
                  <AutoAwesome />
                </Fab>
                <Fab
                  size="small"
                  onClick={() => syncIntegrationState('manual-sync')}
                  title="Manual integration sync"
                >
                  <Code />
                </Fab>
                <Fab
                  size="small"
                  onClick={() => updateAnyComponent('admin-dashboard', 'refresh', { source: 'enhanced-visual-editor' })}
                  title="Refresh admin dashboard"
                >
                  <DashboardCustomize />
                </Fab>
                <Fab
                  size="small"
                  onClick={() => updateAnyComponent('client-portal', 'project-sync', { projectId: selectedProjectForPanels.id })}
                  title="Sync to client portal"
                >
                  <Visibility />
                </Fab>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Fab size="small" onClick={() => setLogoManagerOpen(true)}>
                <Folder />
              </Fab>
              <Fab size="small" onClick={() => setShowAdvancedWorkspace(false)}>
                <Visibility />
              </Fab>
            </Box>
          </Box>

          <Tabs
            value={activeWorkspaceTab}
            onChange={(_, value: AdvancedWorkspaceTab) => setActiveWorkspaceTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 1 }}
          >
            <Tab value="templates" label="Templates" />
            <Tab value="export-presets" label="Export" />
            <Tab value="cloud-sync" label="Cloud" />
            <Tab value="team-collaboration" label="Team" />
            <Tab value="plugins" label="Plugins" />
            <Tab value="animations" label="Animation" />
            <Tab value="component-library" label="Library" />
            <Tab value="design-system" label="Design System" />
            <Tab value="analytics" label="Analytics" />
            <Tab value="audit" label="Audit" />
            <Tab value="monitoring" label="Monitoring" />
            <Tab value="system-management" label="System" />
            <Tab value="ml-optimization" label="ML" />
            <Tab value="advanced-analytics" label="Adv Analytics" />
            <Tab value="ai-assistance" label="AI" />
            <Tab value="templates-presets" label="Templates & Presets" />
            <Tab value="template-presets" label="Presets" />
            <Tab value="client-communication" label="Client Comms" />
            <Tab value="revenue-optimization" label="Revenue" />
            <Tab value="seo" label="SEO" />
            <Tab value="modals" label="Modals" />
            <Tab value="dashboard-components" label="Components" />
            <Tab value="toasts" label="Toasts" />
            <Tab value="branding" label="Branding" />
            <Tab value="landing-settings" label="Landing" />
            <Tab value="showcase-publisher" label="Publish" />
            <Tab value="theming-admin" label="Theming" />
            <Tab value="integration-tools" label="Integration" />
          </Tabs>
          <Divider />

          <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
            {renderAdvancedWorkspace()}
          </Box>
        </Box>
      </Drawer>

      {/* Enhanced Panels - Overlays */}

      {/* Unified Code Studio (replaces separate Code Editor + Live Preview) */}
      <UnifiedCodeStudio
        open={showUnifiedStudio}
        onClose={() => setShowUnifiedStudio(false)}
        initialCode={generatedCode}
      />

      {/* Accessibility Checker Drawer */}
      <AccessibilityChecker
        open={showAccessibility}
        onClose={() => setShowAccessibility(false)}
        iframeRef={React.createRef()}
      />

      {/* Platform Exporter Dialog */}
      <PlatformExporter
        open={showExporter}
        onClose={() => setShowExporter(false)}
        code={generatedCode}
        exportFormat={exportFormat}
      />

      {/* Component Library Drawer */}
      <ComponentLibrary
        open={showComponentLibrary}
        onClose={() => setShowComponentLibrary(false)}
        onUseComponent={handleUseComponent}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcuts
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        onExecuteCommand={handleCommandExecute}
      />

      {/* Code Editor Panel - conditionally rendered */}
      {showCodeEditor && (
        <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '50vh', zIndex: 1000 }}>
          <CodeEditorPanel
            onCodeChange={(code: string, language: string) => {
              if (language === 'javascript' || language === 'typescript') {
                setGeneratedCode(prev => ({ ...prev, react: code }));
              } else if (language === 'css') {
                setGeneratedCode(prev => ({ ...prev, css: code }));
              }
            }}
            readOnly={false}
          />
        </Box>
      )}

      {/* Live Preview Panel - conditionally rendered */}
      {showLivePreviewPanel && (
        <Box sx={{ position: 'fixed', top: 64, right: 300, width: 400, height: 'calc(100vh - 64px)', zIndex: 1000 }}>
          <LivePreviewPanel
            code={generatedCode}
            mode={exportFormat === 'react' ? 'react' : 'html'}
          />
        </Box>
      )}

      <LibrarySuggestionDialog
        open={showLibrarySuggestions}
        onClose={() => setShowLibrarySuggestions(false)}
        componentType={suggestedComponentType}
        profession="videographer"
        onEnableFeatures={handleEnableFeatures}
      />

      <ProfessionConfigWizard
        open={showProfessionWizard}
        onClose={() => setShowProfessionWizard(false)}
        onSave={handleSaveProfession}
        enableClone
        enableImportExport
        enablePreview
        enableABTesting
        enableAnalytics
      />

      <LogoManagementPanel open={logoManagerOpen} onClose={() => setLogoManagerOpen(false)} />
    </Box>
  );
};

// Main component with provider
export const EnhancedVisualEditorPage: React.FC<EnhancedVisualEditorPageProps> = ({
  projectId,
}) => {
  return (
    <VisualEditorProvider>
      <EnhancedVisualEditorPageLoader projectId={projectId} />
    </VisualEditorProvider>
  );
};

/** Inner component that can access the visual editor context to load a project */
const EnhancedVisualEditorPageLoader: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const { loadProject } = useVisualEditor();

  useEffect(() => {
    if (projectId) {
      loadProject({
        id: projectId,
        name: `Project ${projectId}`,
        elements: [],
        settings: {
          width: 1200,
          height: 800,
          backgroundColor: '#ffffff',
          gridSize: 10,
          snapToGrid: true,
        },
        metadata: {
          createdBy: 'current-user',
          createdAt: new Date(),
          lastModified: new Date(),
          version: 1,
        },
        status: 'draft',
      });
    }
  }, [projectId, loadProject]);

  return <EnhancedVisualEditorContent />;
};
