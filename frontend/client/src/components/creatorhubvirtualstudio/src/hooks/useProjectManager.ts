/**
 * Project Management System for Virtual Studio
 * 
 * Handles:
 * - Save/load projects
 * - Auto-save
 * - Project versioning
 * - Cloud sync (Google Drive)
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../state/store';
import { logger } from '../core/services/logger';

const log = logger.module('ProjectManager');

export interface VirtualStudioProject {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  
  // Scene data
  scene: {
    nodes: any[]; // Scene objects (lights, models, props)
    camera: {
      position: [number, number, number];
      rotation: [number, number, number];
      fov: number;
      settings: {
        aperture: number;
        iso: number;
        shutter: number;
        focusDistance: number;
        focalLength: number;
      };
    };
    environment: {
      hdri?: string;
      backgroundColor: string;
      fog?: {
        enabled: boolean;
        density: number;
        color: string;
      };
    };
  };
  
  // Animation data
  timeline: {
    tracks: any[];
    duration: number;
    fps: number;
  };
  
  // Color grading
  colorGrading: {
    lutPath?: string;
    adjustments: {
      brightness: number;
      contrast: number;
      saturation: number;
      temperature: number;
      tint: number;
    };
  };
  
  // Render settings
  renderSettings: {
    width: number;
    height: number;
    quality: 'low' | 'medium' | 'high' | 'ultra';
    enableShadows: boolean;
    enableGI: boolean;
    enableVolumetrics: boolean;
  };
  
  // Metadata
  thumbnail?: string; // Base64 encoded thumbnail
  tags?: string[];
}

export interface ProjectManagerState {
  currentProject: VirtualStudioProject | null;
  projects: VirtualStudioProject[];
  isLoading: boolean;
  isSaving: boolean;
  lastSaved?: Date;
  autoSaveEnabled: boolean;
}

export function useProjectManager() {
  const [state, setState] = useState<ProjectManagerState>({
    currentProject: null,
    projects: [],
    isLoading: false,
    isSaving: false,
    autoSaveEnabled: true,
  });
  
  const store = useAppStore();
  
  // Load projects list from backend
  const loadProjects = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch('/api/virtual-studio/projects', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const projects = data.projects || data; // Handle both response formats
        setState(prev => ({ ...prev, projects, isLoading: false }));
      } else {
        log.error('Failed to load projects from API: ', response.status);
        setState(prev => ({ ...prev, projects: [], isLoading: false }));
      }
    } catch (error) {
      log.error('Failed to load projects:', error);
      setState(prev => ({ ...prev, projects: [], isLoading: false }));
    }
  }, []);
  
  // Save current project
  const saveProject = useCallback(async (projectName?: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isSaving: true }));

    try {
      const currentProject = state.currentProject;
      const project = captureCurrentState(store, projectName || currentProject?.name || 'Untitled Project');

      // Determine if this is a new project or an update
      const isUpdate = currentProject?.id;
      const url = currentProject
        ? `/api/virtual-studio/projects/${currentProject.id}`
        : '/api/virtual-studio/projects';
      const method = isUpdate ? 'PUT' : 'POST';

      // Save to backend
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(project),
      });

      if (response.ok) {
        const savedProject = await response.json();
        setState(prev => ({
          ...prev,
          currentProject: savedProject,
          isSaving: false,
          lastSaved: new Date(),
        }));

        // Reload projects list
        await loadProjects();

        log.info('Project saved successfully:', savedProject.name);
        return true;
      } else {
        const error = await response.json();
        log.error('Failed to save project:', error);
        setState(prev => ({ ...prev, isSaving: false }));
        return false;
      }
    } catch (error) {
      log.error('Failed to save project:', error);
      setState(prev => ({ ...prev, isSaving: false }));
      return false;
    }
  }, [store, state.currentProject, loadProjects]);
  
  // Load a specific project
  const loadProject = useCallback(async (projectId: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`/api/virtual-studio/projects/${projectId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const project = await response.json();

        // Apply project state to store
        store.setScene({
          ...store.scene,
          nodes: project.scene?.nodes ?? store.scene.nodes,
        });

        setState(prev => ({
          ...prev,
          currentProject: project,
          isLoading: false,
        }));

        log.info('Project loaded successfully:', project.name);
        return true;
      } else {
        log.error('Failed to load project:', response.status);
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }
    } catch (error) {
      log.error('Failed to load project:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [store]);

  // Auto-save functionality
  useEffect(() => {
    if (!state.autoSaveEnabled || !state.currentProject) return;

    const autoSaveInterval = setInterval(() => {
      log.debug('Auto-saving project...');
      saveProject();
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [state.autoSaveEnabled, state.currentProject, saveProject]);
  
  return {
    ...state,
    loadProjects,
    saveProject,
    loadProject,
  };
}

// Helper functions
function captureCurrentState(store: any, name: string): VirtualStudioProject {
  // Capture current scene state
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    scene: {
      nodes: store.nodes || [],
      camera: {
        position: [0, 1.6, 3],
        rotation: [0, 0, 0],
        fov: 50,
        settings: {
          aperture: 2.8,
          iso: 100,
          shutter: 1/125,
          focusDistance: 3.0,
          focalLength: 50,
        },
      },
      environment: {
        backgroundColor: '#000000',
      },
    },
    timeline: {
      tracks: [],
      duration: 10,
      fps: 30,
    },
    colorGrading: {
      adjustments: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        temperature: 0,
        tint: 0,
      },
    },
    renderSettings: {
      width: 1920,
      height: 1080,
      quality:'high',
      enableShadows: true,
      enableGI: true,
      enableVolumetrics: false,
    },
  };
}

// Note: localStorage functions removed - all data now persisted in database
// Projects are automatically saved to PostgreSQL via the backend API
