/**
 * Project Context - Centralized project state management
 * Provides project-specific settings, data, and operations
 */

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDynamicProfessions } from '../components/universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '../hooks/useProfessionConfigs';
import { useProfessionAdapter } from '../hooks/useProfessionAdapter';
import getProfessionIcon from '../utils/profession-icons';

// Project data interface
export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  clientName: string;
  eventDate: string;
  location?: string;
  projectType: string;
  profession: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  // Project settings
  settings: {
    showcaseSettings: any;
    downloadProtection: 'none' | 'password' | 'timelimit';
    watermark: 'none' | 'text' | 'logo' | 'both';
    clientAccess: 'full' | 'limited' | 'readonly';
    pricing: any;
    meetingPreferences: any;
};
  // Project metadata
  metadata: {
    totalDays: number;
    activeDays: number[];
    memoryCardConfigs: any[];
    customCategories: string[];
    customDayNames: string[];
    selectedMemoryCards: any[];
    shotList: any[];
    collaborators: any[];
};
  // Integration status
  integrations: {
    googleDrive: boolean;
    googlePhotos: boolean;
    weddingTimeline: boolean;
    showcase: boolean;
    worklog: boolean;
};
}

// Project context type
export interface ProjectContextType {
  // Current project
  currentProject: ProjectData | null;
  setCurrentProject: (project: ProjectData | null) => void;
  
  // Project management
  projects: ProjectData[];
  setProjects: (projects: ProjectData[]) => void;
  loadProjects: () => Promise<ProjectData[]>;
  createProject: (projectData: Omit<ProjectData, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ProjectData>;
  updateProject: (projectId: string, projectData: Partial<ProjectData>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  loadProject: (projectId: string) => Promise<ProjectData | null>;
  
  // Project settings
  updateProjectSettings: (projectId: string, settings: Partial<ProjectData['settings']>) => Promise<void>;
  getProjectSettings: (projectId: string) => ProjectData['settings'] | null;
  
  // Project metadata
  updateProjectMetadata: (projectId: string, metadata: Partial<ProjectData['metadata']>) => Promise<void>;
  getProjectMetadata: (projectId: string) => ProjectData['metadata'] | null;
  
  // Integration status
  updateIntegrationStatus: (projectId: string, integration: keyof ProjectData['integrations'], status: boolean) => Promise<void>;
  getIntegrationStatus: (projectId: string, integration: keyof ProjectData['integrations']) => boolean | null;
  
  // Project state
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  
  // Project operations
  syncProject: (projectId: string) => Promise<void>;
  syncAllProjects: () => Promise<void>;
  shareProject: (projectId: string, shareData: any) => Promise<void>;
  getProjectShares: (projectId: string) => Promise<any[]>;
  saveAsTemplate: (projectId: string, templateData: any) => Promise<void>;
  loadFromTemplate: (templateId: string) => Promise<any>;
  getProjectTemplates: () => Promise<any[]>;
  
  // Additional project management functions
  getProjectsByStatus: (status: string) => Promise<ProjectData[]>;
  getProjectsByProfession: (profession: string) => Promise<ProjectData[]>;
  duplicateProject: (projectId: string, newName: string) => Promise<ProjectData>;
  archiveProject: (projectId: string) => Promise<void>;
  restoreProject: (projectId: string) => Promise<void>;
  getProjectStats: (projectId: string) => Promise<any>;
  exportProject: (projectId: string, format: 'json' | 'pdf' | 'csv') => Promise<any>;
  importProject: (projectData: any) => Promise<ProjectData>;
  
  // Project collaboration functions
  addProjectCollaborator: (projectId: string, collaboratorData: any) => Promise<void>;
  removeProjectCollaborator: (projectId: string, collaboratorId: string) => Promise<void>;
  getProjectCollaborators: (projectId: string) => Promise<any[]>;
  updateCollaboratorPermissions: (projectId: string, collaboratorId: string, permissions: any) => Promise<void>;
  inviteProjectCollaborator: (projectId: string, email: string, role: string) => Promise<void>;
  
  // Project file management functions
  uploadProjectFile: (projectId: string, file: File, metadata?: any) => Promise<any>;
  getProjectFiles: (projectId: string) => Promise<any[]>;
  deleteProjectFile: (projectId: string, fileId: string) => Promise<void>;
  updateProjectFile: (projectId: string, fileId: string, updates: any) => Promise<void>;
  shareProjectFile: (projectId: string, fileId: string, shareData: any) => Promise<void>;
  
  // Project workflow functions
  updateProjectStatus: (projectId: string, status: string) => Promise<void>;
  addProjectMilestone: (projectId: string, milestone: any) => Promise<void>;
  updateProjectMilestone: (projectId: string, milestoneId: string, updates: any) => Promise<void>;
  completeProjectMilestone: (projectId: string, milestoneId: string) => Promise<void>;
  getProjectTimeline: (projectId: string) => Promise<any>;
  
  // Project communication functions
  addProjectComment: (projectId: string, comment: any) => Promise<void>;
  getProjectComments: (projectId: string) => Promise<any[]>;
  updateProjectComment: (projectId: string, commentId: string, updates: any) => Promise<void>;
  deleteProjectComment: (projectId: string, commentId: string) => Promise<void>;
  
  // Project backup and recovery functions
  createProjectBackup: (projectId: string) => Promise<any>;
  restoreProjectFromBackup: (projectId: string, backupId: string) => Promise<void>;
  getProjectBackups: (projectId: string) => Promise<any[]>;
  deleteProjectBackup: (projectId: string, backupId: string) => Promise<void>;
  
  // Project event and real-time functions
  emitProjectEvent: (projectId: string, eventType: string, eventData: any) => Promise<void>;
  subscribeToProjectEvents: (projectId: string, eventTypes: string[], callback: (event: any) => void) => void;
  unsubscribeFromProjectEvents: (projectId: string, eventTypes: string[]) => void;
  getProjectEventHistory: (projectId: string, limit?: number) => Promise<any[]>;
  
  // Project analytics and reporting functions
  getProjectAnalytics: (projectId: string, dateRange?: { start: Date; end: Date }) => Promise<any>;
  getProjectPerformanceMetrics: (projectId: string) => Promise<any>;
  generateProjectReport: (projectId: string, reportType: 'summary' | 'detailed' | 'financial') => Promise<any>;
  getProjectHealthScore: (projectId: string) => Promise<number>;
  
  // Project notification and alert functions
  createProjectNotification: (projectId: string, notification: any) => Promise<void>;
  getProjectNotifications: (projectId: string, unreadOnly?: boolean) => Promise<any[]>;
  markNotificationAsRead: (projectId: string, notificationId: string) => Promise<void>;
  deleteProjectNotification: (projectId: string, notificationId: string) => Promise<void>;
  
  // Project search and filtering functions
  searchProjects: (query: string, filters?: any) => Promise<ProjectData[]>;
  getProjectsByDateRange: (startDate: Date, endDate: Date) => Promise<ProjectData[]>;
  getProjectsByClient: (clientId: string) => Promise<ProjectData[]>;
  getProjectsByTags: (tags: string[]) => Promise<ProjectData[]>;
  
  // Project validation and health check functions
  validateProjectData: (projectData: any) => Promise<{ isValid: boolean; errors: string[] }>;
  checkProjectHealth: (projectId: string) => Promise<{ status: 'healthy' | 'warning' | 'critical'; issues: string[] }>;
  getProjectDependencies: (projectId: string) => Promise<any[]>;
  checkProjectConflicts: (projectId: string) => Promise<any[]>;
  
  // Project state management and caching functions
  cacheProjectData: (projectId: string, data: any) => Promise<void>;
  getCachedProjectData: (projectId: string) => Promise<any>;
  invalidateProjectCache: (projectId: string) => Promise<void>;
  refreshProjectCache: (projectId: string) => Promise<void>;
  
  // Project persistence and offline functions
  saveProjectDraft: (projectId: string, draftData: any) => Promise<void>;
  getProjectDraft: (projectId: string) => Promise<any>;
  deleteProjectDraft: (projectId: string) => Promise<void>;
  syncProjectOffline: (projectId: string) => Promise<void>;
  
  // Project integration and data flow functions
  connectProjectIntegration: (projectId: string, integrationType: string, config: any) => Promise<void>;
  disconnectProjectIntegration: (projectId: string, integrationType: string) => Promise<void>;
  getProjectIntegrations: (projectId: string) => Promise<any[]>;
  testProjectIntegration: (projectId: string, integrationType: string) => Promise<{ status: 'success' | 'error'; message: string }>;
  
  // Project data transformation and migration functions
  transformProjectData: (projectId: string, transformation: any) => Promise<any>;
  migrateProjectData: (projectId: string, fromVersion: string, toVersion: string) => Promise<void>;
  getProjectDataVersion: (projectId: string) => Promise<string>;
  rollbackProjectData: (projectId: string, toVersion: string) => Promise<void>;
  
  // Project performance and optimization functions
  optimizeProjectData: (projectId: string) => Promise<{ optimized: boolean; improvements: string[] }>;
  analyzeProjectData: (projectId: string) => Promise<{ insights: any[]; recommendations: string[] }>;
  cleanupProjectData: (projectId: string) => Promise<{ cleaned: boolean; removedItems: string[] }>;
  
  // Project security and access control functions
  setProjectPermissions: (projectId: string, permissions: any) => Promise<void>;
  getProjectPermissions: (projectId: string) => Promise<any>;
  checkProjectAccess: (projectId: string, userId: string, action: string) => Promise<boolean>;
  auditProjectAccess: (projectId: string) => Promise<any[]>;
  
  // Project compliance and governance functions
  validateProjectCompliance: (projectId: string, standards: string[]) => Promise<{ compliant: boolean; violations: string[] }>;
  getProjectComplianceReport: (projectId: string) => Promise<any>;
  updateProjectCompliance: (projectId: string, complianceData: any) => Promise<void>;
  getProjectAuditTrail: (projectId: string) => Promise<any[]>;
}

// Create context
const ProjectContext = createContext<ProjectContextType | null>(null);

// Provider component
export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects from API
  const loadProjects = useCallback(async (): Promise<ProjectData[]> => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to load projects');
    }

      const projectsData = await response.json();
      setProjects(projectsData);
      return projectsData;
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load projects';
      setError(errorMessage);
      return [];
  } finally {
      setIsLoading(false);
  }
}, [user]);

  const createProject = useCallback(async (projectData: Omit<ProjectData, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}`,
        },
        body: JSON.stringify(projectData),
    });

      if (!response.ok) {
        throw new Error('Failed to create project');
    }

      const newProject = await response.json();
      setProjects(prev => [...prev, newProject]);

      // Sync showcase password settings if project has download protection enabled
      // Check if projectData has showcaseGallerySecurity or downloadProtection
      const projectDataAny = projectData as any;
      if (projectDataAny.downloadProtection === 'password' || 
          projectDataAny.showcaseGallerySecurity?.passwordRequired ||
          projectDataAny.showcaseGallerySecurity?.password) {
        
        const password = projectDataAny.showcaseGallerySecurity?.password || 
                        projectDataAny.downloadPassword ||
                        projectDataAny.weddingTimelineSecurity?.password;
        
        if (password) {
          try {
            // Sync password to showcase settings
            const currentSettings = await fetch('/api/user/kv/showcase-settings', { 
              credentials: 'include' 
            }).then(r => r.ok ? r.json().catch(() => null) : null).catch(() => null);
            
            const serverVal = currentSettings && typeof currentSettings === 'object' && 'value' in currentSettings 
              ? currentSettings.value 
              : (currentSettings?.data ?? currentSettings);
            
            const existingSettings = serverVal || 
              (() => { 
                try { 
                  return JSON.parse(localStorage.getItem('showcase-settings') || 'null'); 
                } catch { 
                  return null; 
                }
              })();
            
            const updatedSettings = {
              ...existingSettings,
              downloadProtection: projectDataAny.downloadProtection === 'password' ? 'password' : (existingSettings?.downloadProtection || 'none'),
              downloadPassword: password,
            };
            
            // Save to server
            await fetch('/api/user/kv/showcase-settings', {
              method: 'POST',
              headers: { 'Content-Type' : 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ value: updatedSettings }),
            }).catch(() => {
              // Fallback to localStorage if server fails
              localStorage.setItem('showcase-settings', JSON.stringify(updatedSettings));
            });
          } catch (syncError) {
            console.warn('Failed to sync showcase password settings: ', syncError);
            // Don't fail project creation if password sync fails
          }
        }
      }

      return newProject;
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const updateProject = useCallback(async (projectId: string, projectData: Partial<ProjectData>) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(projectData),
    });

      if (!response.ok) {
        throw new Error('Failed to update project');
    }

      const updatedProject = await response.json();
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
      if (currentProject?.id === projectId) {
        setCurrentProject(updatedProject);
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user, currentProject]);

  const deleteProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to delete project');
    }

      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user, currentProject]);

  const loadProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to load project');
    }

      const project = await response.json();
      setCurrentProject(project);
      return project;
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load project';
      setError(errorMessage);
      return null;
  }
}, [user]);

  const updateProjectSettings = useCallback(async (projectId: string, settings: Partial<ProjectData['settings']>) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(settings),
    });

      if (!response.ok) {
        throw new Error('Failed to update project settings');
    }

      // Update local state
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, settings: { ...p.settings, ...settings } } : p));
      if (currentProject?.id === projectId) {
        setCurrentProject(prev => prev ? { ...prev, settings: { ...prev.settings, ...settings } } : null);
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project settings';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user, currentProject]);

  const getProjectSettings = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.settings || null;
}, [projects]);

  const updateProjectMetadata = useCallback(async (projectId: string, metadata: Partial<ProjectData['metadata']>) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/metadata`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(metadata),
    });

      if (!response.ok) {
        throw new Error('Failed to update project metadata');
    }

      // Update local state
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, metadata: { ...p.metadata, ...metadata } } : p));
      if (currentProject?.id === projectId) {
        setCurrentProject(prev => prev ? { ...prev, metadata: { ...prev.metadata, ...metadata } } : null);
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project metadata';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user, currentProject]);

  const getProjectMetadata = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.metadata || null;
}, [projects]);

  const updateIntegrationStatus = useCallback(async (projectId: string, integration: keyof ProjectData['integrations'], status: boolean) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/integrations`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ [integration]: status }),
    });

      if (!response.ok) {
        throw new Error('Failed to update integration status');
    }

      // Update local state
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, integrations: { ...p.integrations, [integration]: status } } : p));
      if (currentProject?.id === projectId) {
        setCurrentProject(prev => prev ? { ...prev, integrations: { ...prev.integrations, [integration]: status } } : null);
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update integration status';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user, currentProject]);

  const getIntegrationStatus = useCallback((projectId: string, integration: keyof ProjectData['integrations']) => {
    const project = projects.find(p => p.id === projectId);
    return project?.integrations[integration] || null;
}, [projects]);

  const syncProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to sync project');
    }

      await loadProjects();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync project';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user, loadProjects]);

  const syncAllProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to sync projects');
    }

      await loadProjects();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync projects';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user, loadProjects]);

  const shareProject = useCallback(async (projectId: string, shareData: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(shareData),
    });

      if (!response.ok) {
        throw new Error('Failed to share project');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to share project';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectShares = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/shares`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project shares');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project shares';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const saveAsTemplate = useCallback(async (projectId: string, templateData: any) => {
    try {
      const response = await fetch('/api/project-templates', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ projectId, ...templateData }),
    });

      if (!response.ok) {
        throw new Error('Failed to save as template');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save as template';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const loadFromTemplate = useCallback(async (templateId: string) => {
    try {
      const response = await fetch(`/api/project-templates/${templateId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to load template');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load template';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/project-templates', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get templates');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get templates';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectsByStatus = useCallback(async (status: string) => {
    try {
      const response = await fetch(`/api/projects?status=${status}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get projects by status');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get projects by status';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectsByProfession = useCallback(async (profession: string) => {
    try {
      const response = await fetch(`/api/projects?profession=${profession}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get projects by profession');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get projects by profession';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const duplicateProject = useCallback(async (projectId: string, newName: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ newName }),
    });

      if (!response.ok) {
        throw new Error('Failed to duplicate project');
    }

      const duplicatedProject = await response.json();
      setProjects(prev => [...prev, duplicatedProject]);
      return duplicatedProject;
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate project';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const archiveProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/archive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to archive project');
    }

      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: 'archived' as const } : p));
      if (currentProject?.id === projectId) {
        setCurrentProject(prev => prev ? { ...prev, status: 'archived' as const } : null);
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive project';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user, currentProject]);

  const restoreProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to restore project');
    }

      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: 'draft' as const } : p));
      if (currentProject?.id === projectId) {
        setCurrentProject(prev => prev ? { ...prev, status: 'draft' as const } : null);
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restore project';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user, currentProject]);

  const getProjectStats = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project stats');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project stats';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const exportProject = useCallback(async (projectId: string, format: 'json' | 'pdf' | 'csv') => {
    try {
      const response = await fetch(`/api/projects/${projectId}/export?format=${format}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to export project');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export project';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const importProject = useCallback(async (projectData: any) => {
    try {
      const response = await fetch('/api/projects/import', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(projectData),
    });

      if (!response.ok) {
        throw new Error('Failed to import project');
    }

      const importedProject = await response.json();
      setProjects(prev => [...prev, importedProject]);
      return importedProject;
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import project';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project collaboration functions
  const addProjectCollaborator = useCallback(async (projectId: string, collaboratorData: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(collaboratorData),
    });

      if (!response.ok) {
        throw new Error('Failed to add project collaborator');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add project collaborator';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const removeProjectCollaborator = useCallback(async (projectId: string, collaboratorId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators/${collaboratorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to remove project collaborator');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove project collaborator';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectCollaborators = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project collaborators');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project collaborators';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const updateCollaboratorPermissions = useCallback(async (projectId: string, collaboratorId: string, permissions: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators/${collaboratorId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(permissions),
    });

      if (!response.ok) {
        throw new Error('Failed to update collaborator permissions');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update collaborator permissions';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const inviteProjectCollaborator = useCallback(async (projectId: string, email: string, role: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators/invite`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ email, role }),
    });

      if (!response.ok) {
        throw new Error('Failed to invite project collaborator');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to invite project collaborator';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project file management functions
  const uploadProjectFile = useCallback(async (projectId: string, file: File, metadata?: any) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
    }

      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
        body: formData,
    });

      if (!response.ok) {
        throw new Error('Failed to upload project file');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload project file';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectFiles = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project files');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project files';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const deleteProjectFile = useCallback(async (projectId: string, fileId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to delete project file');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project file';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const updateProjectFile = useCallback(async (projectId: string, fileId: string, updates: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(updates),
    });

      if (!response.ok) {
        throw new Error('Failed to update project file');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project file';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const shareProjectFile = useCallback(async (projectId: string, fileId: string, shareData: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(shareData),
    });

      if (!response.ok) {
        throw new Error('Failed to share project file');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to share project file';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project workflow functions
  const updateProjectStatus = useCallback(async (projectId: string, status: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ status }),
    });

      if (!response.ok) {
        throw new Error('Failed to update project status');
    }

      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: status as any } : p));
      if (currentProject?.id === projectId) {
        setCurrentProject(prev => prev ? { ...prev, status: status as any } : null);
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project status';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user, currentProject]);

  const addProjectMilestone = useCallback(async (projectId: string, milestone: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(milestone),
    });

      if (!response.ok) {
        throw new Error('Failed to add project milestone');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add project milestone';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const updateProjectMilestone = useCallback(async (projectId: string, milestoneId: string, updates: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(updates),
    });

      if (!response.ok) {
        throw new Error('Failed to update project milestone');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project milestone';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const completeProjectMilestone = useCallback(async (projectId: string, milestoneId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to complete project milestone');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete project milestone';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectTimeline = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/timeline`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project timeline');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project timeline';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project communication functions
  const addProjectComment = useCallback(async (projectId: string, comment: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(comment),
    });

      if (!response.ok) {
        throw new Error('Failed to add project comment');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add project comment';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectComments = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/comments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project comments');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project comments';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const updateProjectComment = useCallback(async (projectId: string, commentId: string, updates: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(updates),
    });

      if (!response.ok) {
        throw new Error('Failed to update project comment');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project comment';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const deleteProjectComment = useCallback(async (projectId: string, commentId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to delete project comment');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project comment';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project backup and recovery functions
  const createProjectBackup = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/backup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to create project backup');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project backup';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const restoreProjectFromBackup = useCallback(async (projectId: string, backupId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/backup/${backupId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to restore project from backup');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restore project from backup';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectBackups = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/backups`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project backups');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project backups';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const deleteProjectBackup = useCallback(async (projectId: string, backupId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/backups/${backupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to delete project backup');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project backup';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project event and real-time functions
  const emitProjectEvent = useCallback(async (projectId: string, eventType: string, eventData: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ eventType, eventData }),
    });

      if (!response.ok) {
        throw new Error('Failed to emit project event');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to emit project event';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const subscribeToProjectEvents = useCallback((projectId: string, eventTypes: string[], callback: (event: any) => void) => {
    // This would typically use WebSocket or Server-Sent Events
    // For now, we'll implement a simple polling mechanism
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/events/latest`, {
          headers: {
            'Authorization': `Bearer ${user?.id}`,
        },
      });
        
        if (response.ok) {
          const events = await response.json();
          events.forEach((event: any) => {
            if (eventTypes.includes(event.eventType)) {
              callback(event);
          }
        });
      }
    } catch (error) {
        console.warn('Failed to fetch project events:', error);
    }
  }, 5000); // Poll every 5 seconds

    // Store interval for cleanup
    return () => clearInterval(interval);
}, [user]);

  const unsubscribeFromProjectEvents = useCallback((projectId: string, eventTypes: string[]) => {
    // Cleanup would be handled by the component using this function
    console.log(`Unsubscribing from project ${projectId} events:`, eventTypes);
}, []);

  const getProjectEventHistory = useCallback(async (projectId: string, limit: number = 50) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/events?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project event history');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project event history';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project analytics and reporting functions
  const getProjectAnalytics = useCallback(async (projectId: string, dateRange?: { start: Date; end: Date }) => {
    try {
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('start', dateRange.start.toISOString());
        params.append('end', dateRange.end.toISOString());
    }

      const queryString = params.toString();
      const response = await fetch(
        `/api/projects/${projectId}/analytics${queryString ? `?${queryString}` : ''}`,
        {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
      });

      if (!response.ok) {
        throw new Error('Failed to get project analytics');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project analytics';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectPerformanceMetrics = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/performance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project performance metrics');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project performance metrics';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const generateProjectReport = useCallback(async (projectId: string, reportType: 'summary' | 'detailed' | 'financial') => {
    try {
      const response = await fetch(`/api/projects/${projectId}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ reportType }),
    });

      if (!response.ok) {
        throw new Error('Failed to generate project report');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate project report';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectHealthScore = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/health-score`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project health score');
    }

      const data = await response.json();
      return data.score;
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project health score';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project notification and alert functions
  const createProjectNotification = useCallback(async (projectId: string, notification: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(notification),
    });

      if (!response.ok) {
        throw new Error('Failed to create project notification');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project notification';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectNotifications = useCallback(async (projectId: string, unreadOnly: boolean = false) => {
    try {
      const params = new URLSearchParams();
      if (unreadOnly) {
        params.append('unreadOnly','true');
    }

      const response = await fetch(`/api/projects/${projectId}/notifications?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project notifications');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project notifications';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const markNotificationAsRead = useCallback(async (projectId: string, notificationId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark notification as read';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const deleteProjectNotification = useCallback(async (projectId: string, notificationId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to delete project notification');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project notification';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project search and filtering functions
  const searchProjects = useCallback(async (query: string, filters?: any) => {
    try {
      const params = new URLSearchParams();
      params.append('q', query);
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            params.append(key, String(value));
        }
      });
    }

      const response = await fetch(`/api/projects/search?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to search projects');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search projects';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectsByDateRange = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      const params = new URLSearchParams();
      params.append('start', startDate.toISOString());
      params.append('end', endDate.toISOString());

      const response = await fetch(`/api/projects?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get projects by date range');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get projects by date range';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectsByClient = useCallback(async (clientId: string) => {
    try {
      const response = await fetch(`/api/projects?clientId=${clientId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get projects by client');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get projects by client';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectsByTags = useCallback(async (tags: string[]) => {
    try {
      const params = new URLSearchParams();
      tags.forEach(tag => params.append('tags', tag));

      const response = await fetch(`/api/projects?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get projects by tags');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get projects by tags';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project validation and health check functions
  const validateProjectData = useCallback(async (projectData: any) => {
    try {
      const response = await fetch('/api/projects/validate', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(projectData),
    });

      if (!response.ok) {
        throw new Error('Failed to validate project data');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate project data';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const checkProjectHealth = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to check project health');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check project health';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectDependencies = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/dependencies`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project dependencies');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project dependencies';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const checkProjectConflicts = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/conflicts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to check project conflicts');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check project conflicts';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project state management and caching functions
  const cacheProjectData = useCallback(async (projectId: string, data: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/cache`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(data),
    });

      if (!response.ok) {
        throw new Error('Failed to cache project data');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cache project data';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getCachedProjectData = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/cache`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get cached project data');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get cached project data';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const invalidateProjectCache = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/cache`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to invalidate project cache');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to invalidate project cache';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const refreshProjectCache = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/cache/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to refresh project cache');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh project cache';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project persistence and offline functions
  const saveProjectDraft = useCallback(async (projectId: string, draftData: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/draft`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(draftData),
    });

      if (!response.ok) {
        throw new Error('Failed to save project draft');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save project draft';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectDraft = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/draft`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project draft');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project draft';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const deleteProjectDraft = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/draft`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to delete project draft');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project draft';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const syncProjectOffline = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/sync/offline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to sync project offline');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync project offline';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project integration and data flow functions
  const connectProjectIntegration = useCallback(async (projectId: string, integrationType: string, config: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/integrations/${integrationType}`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(config),
    });

      if (!response.ok) {
        throw new Error('Failed to connect project integration');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect project integration';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const disconnectProjectIntegration = useCallback(async (projectId: string, integrationType: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/integrations/${integrationType}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to disconnect project integration');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect project integration';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectIntegrations = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/integrations`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project integrations');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project integrations';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const testProjectIntegration = useCallback(async (projectId: string, integrationType: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/integrations/${integrationType}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to test project integration');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test project integration';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project data transformation and migration functions
  const transformProjectData = useCallback(async (projectId: string, transformation: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/transform`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(transformation),
    });

      if (!response.ok) {
        throw new Error('Failed to transform project data');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transform project data';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const migrateProjectData = useCallback(async (projectId: string, fromVersion: string, toVersion: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/migrate`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ fromVersion, toVersion }),
    });

      if (!response.ok) {
        throw new Error('Failed to migrate project data');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to migrate project data';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectDataVersion = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/version`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project data version');
    }

      const data = await response.json();
      return data.version;
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project data version';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const rollbackProjectData = useCallback(async (projectId: string, toVersion: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ toVersion }),
    });

      if (!response.ok) {
        throw new Error('Failed to rollback project data');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rollback project data';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project performance and optimization functions
  const optimizeProjectData = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/optimize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to optimize project data');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to optimize project data';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const analyzeProjectData = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to analyze project data');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze project data';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const cleanupProjectData = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/cleanup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to cleanup project data');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cleanup project data';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project security and access control functions
  const setProjectPermissions = useCallback(async (projectId: string, permissions: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(permissions),
    });

      if (!response.ok) {
        throw new Error('Failed to set project permissions');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set project permissions';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectPermissions = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/permissions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project permissions');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project permissions';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const checkProjectAccess = useCallback(async (projectId: string, userId: string, action: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/access`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ userId, action }),
    });

      if (!response.ok) {
        throw new Error('Failed to check project access');
    }

      const data = await response.json();
      return data.hasAccess;
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check project access';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const auditProjectAccess = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/audit`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to audit project access');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to audit project access';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  // Project compliance and governance functions
  const validateProjectCompliance = useCallback(async (projectId: string, standards: string[]) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/compliance`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json', 'Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify({ standards }),
    });

      if (!response.ok) {
        throw new Error('Failed to validate project compliance');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate project compliance';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectComplianceReport = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/compliance/report`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project compliance report');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get project compliance report';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const updateProjectCompliance = useCallback(async (projectId: string, complianceData: any) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/compliance`, {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json', 'Authorization': `Bearer ${user?.id}`,
      },
        body: JSON.stringify(complianceData),
    });

      if (!response.ok) {
        throw new Error('Failed to update project compliance');
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project compliance';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const getProjectAuditTrail = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/audit-trail`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
      },
    });

      if (!response.ok) {
        throw new Error('Failed to get project audit trail');
    }

      return await response.json();
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message :'Failed to get project audit trail';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, [user]);

  const contextValue: ProjectContextType = {
    currentProject,
    setCurrentProject,
    projects,
    setProjects,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    loadProject,
    updateProjectSettings,
    getProjectSettings,
    updateProjectMetadata,
    getProjectMetadata,
    updateIntegrationStatus,
    getIntegrationStatus,
    isLoading,
    error,
    setError,
    syncProject,
    syncAllProjects,
    shareProject,
    getProjectShares,
    saveAsTemplate,
    loadFromTemplate,
    getProjectTemplates,
    getProjectsByStatus,
    getProjectsByProfession,
    duplicateProject,
    archiveProject,
    restoreProject,
    getProjectStats,
    exportProject,
    importProject,
    addProjectCollaborator,
    removeProjectCollaborator,
    getProjectCollaborators,
    updateCollaboratorPermissions,
    inviteProjectCollaborator,
    uploadProjectFile,
    getProjectFiles,
    deleteProjectFile,
    updateProjectFile,
    shareProjectFile,
    updateProjectStatus,
    addProjectMilestone,
    updateProjectMilestone,
    completeProjectMilestone,
    getProjectTimeline,
    addProjectComment,
    getProjectComments,
    updateProjectComment,
    deleteProjectComment,
    createProjectBackup,
    restoreProjectFromBackup,
    getProjectBackups,
    deleteProjectBackup,
    emitProjectEvent,
    subscribeToProjectEvents,
    unsubscribeFromProjectEvents,
    getProjectEventHistory,
    getProjectAnalytics,
    getProjectPerformanceMetrics,
    generateProjectReport,
    getProjectHealthScore,
    createProjectNotification,
    getProjectNotifications,
    markNotificationAsRead,
    deleteProjectNotification,
    searchProjects,
    getProjectsByDateRange,
    getProjectsByClient,
    getProjectsByTags,
    validateProjectData,
    checkProjectHealth,
    getProjectDependencies,
    checkProjectConflicts,
    cacheProjectData,
    getCachedProjectData,
    invalidateProjectCache,
    refreshProjectCache,
    saveProjectDraft,
    getProjectDraft,
    deleteProjectDraft,
    syncProjectOffline,
    connectProjectIntegration,
    disconnectProjectIntegration,
    getProjectIntegrations,
    testProjectIntegration,
    transformProjectData,
    migrateProjectData,
    getProjectDataVersion,
    rollbackProjectData,
    optimizeProjectData,
    analyzeProjectData,
    cleanupProjectData,
    setProjectPermissions,
    getProjectPermissions,
    checkProjectAccess,
    auditProjectAccess,
    validateProjectCompliance,
    getProjectComplianceReport,
    updateProjectCompliance,
    getProjectAuditTrail,
};

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

// Hook to use project context
export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined || context === null) {
    throw new Error('useProject must be used within a ProjectProvider');
}
  return context;
};

export default ProjectContext;
