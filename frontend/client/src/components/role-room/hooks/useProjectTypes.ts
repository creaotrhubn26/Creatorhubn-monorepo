import { useState, useCallback } from 'react';

export interface ProjectType {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  isCustom: boolean;
}

const DEFAULT_PROJECT_TYPES: ProjectType[] = [
  { id: 'wedding', name: 'Bryllup', icon: 'favorite', color: '#e91e63', description: 'Bryllupsfotografering', isCustom: false },
  { id: 'portrait', name: 'Portrett', icon: 'portrait', color: '#9c27b0', description: 'Portrettfotografering', isCustom: false },
  { id: 'event', name: 'Event', icon: 'event', color: '#2196f3', description: 'Eventfotografering', isCustom: false },
  { id: 'commercial', name: 'Kommersiell', icon: 'business', color: '#ff9800', description: 'Kommersiell fotografering', isCustom: false },
  { id: 'video', name: 'Video', icon: 'movie', color: '#f44336', description: 'Videoproduksjon', isCustom: false },
  { id: 'casting', name: 'Casting', icon: 'groups', color: '#10b981', description: 'Casting og rollebesetning', isCustom: false },
];

export function useProjectTypes() {
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>(DEFAULT_PROJECT_TYPES);
  const [loading, setLoading] = useState(false);
  const [isLoading] = useState(false);

  const allTypes = projectTypes;

  const addProjectType = useCallback((type: Omit<ProjectType, 'id' | 'isCustom'>) => {
    const newType: ProjectType = {
      ...type,
      id: `custom-${Date.now()}`,
      isCustom: true,
    };
    setProjectTypes(prev => [...prev, newType]);
    return newType;
  }, []);

  const createProjectType = useCallback((type: Omit<ProjectType, 'id' | 'isCustom'>) => {
    return addProjectType(type);
  }, [addProjectType]);

  const removeProjectType = useCallback((id: string) => {
    setProjectTypes(prev => prev.filter(t => t.id !== id || !t.isCustom));
  }, []);

  const updateProjectType = useCallback((id: string, updates: Partial<ProjectType>) => {
    setProjectTypes(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const trackUsage = useCallback((typeId: string) => {
    console.log(`[ProjectTypes] Tracking usage of: ${typeId}`);
  }, []);

  return {
    projectTypes,
    allTypes,
    loading,
    isLoading,
    addProjectType,
    createProjectType,
    removeProjectType,
    updateProjectType,
    trackUsage,
  };
}
