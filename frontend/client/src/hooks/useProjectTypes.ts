import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface ProjectType {
  id: number;
  userId: number;
  name: string;
  icon: string;
  category: string;
  description?: string;
  usageCount: number;
  isGlobal: boolean;
  isTrending: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTypesData {
  userTypes: ProjectType[];
  defaultTypes: ProjectType[];
  trendingTypes: ProjectType[];
}

export interface UseProjectTypesReturn {
  allTypes: ProjectType[];
  userTypes: ProjectType[];
  defaultTypes: ProjectType[];
  trendingTypes: ProjectType[];
  isLoading: boolean;
  error: string | null;
  createProjectType: (data: { name: string; icon: string; category?: string; description?: string }) => Promise<ProjectType>;
  updateProjectType: (id: number, data: { name?: string; icon?: string; category?: string; description?: string }) => Promise<ProjectType>;
  deleteProjectType: (id: number) => Promise<void>;
  trackUsage: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useProjectTypes = (): UseProjectTypesReturn => {
  const [data, setData] = useState<ProjectTypesData>({
    userTypes: [],
    defaultTypes: [],
    trendingTypes: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all project types
  const fetchProjectTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest<ProjectTypesData>('/api/project-types', {
        method: 'GET',
      });
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch project types');
      console.error('Error fetching project types: ', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchProjectTypes();
  }, [fetchProjectTypes]);

  // Create new project type
  const createProjectType = useCallback(async (typeData: { name: string; icon: string; category?: string; description?: string }) => {
    try {
      const newType = await apiRequest<ProjectType>('/api/project-types', {
        method: 'POST',
        body: JSON.stringify(typeData),
      });
      
      // Refresh data
      await fetchProjectTypes();
      
      return newType;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create project type');
    }
  }, [fetchProjectTypes]);

  // Update project type
  const updateProjectType = useCallback(async (id: number, typeData: { name?: string; icon?: string; category?: string; description?: string }) => {
    try {
      const updated = await apiRequest<ProjectType>(`/api/project-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(typeData),
      });
      
      // Refresh data
      await fetchProjectTypes();
      
      return updated;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update project type');
    }
  }, [fetchProjectTypes]);

  // Delete project type
  const deleteProjectType = useCallback(async (id: number) => {
    try {
      await apiRequest(`/api/project-types/${id}`, {
        method: 'DELETE',
      });
      
      // Refresh data
      await fetchProjectTypes();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete project type');
    }
  }, [fetchProjectTypes]);

  // Track usage (for ML learning)
  const trackUsage = useCallback(async (id: number) => {
    try {
      await apiRequest(`/api/project-types/${id}/use`, {
        method:'POST',
      });
      // Don't refresh immediately to avoid performance issues
    } catch (err: any) {
      console.error('Failed to track usage:', err);
      // Don't throw error - tracking is non-critical
    }
  }, []);

  // Merge all types (default + user + trending, removing duplicates)
  const allTypes = [
    ...data.defaultTypes,
    ...data.userTypes.filter(ut => !data.defaultTypes.some(dt => dt.name === ut.name)),
    ...data.trendingTypes.filter(tt => 
      !data.defaultTypes.some(dt => dt.name === tt.name) &&
      !data.userTypes.some(ut => ut.name === tt.name)
    ),
  ];

  return {
    allTypes,
    userTypes: data.userTypes,
    defaultTypes: data.defaultTypes,
    trendingTypes: data.trendingTypes,
    isLoading,
    error,
    createProjectType,
    updateProjectType,
    deleteProjectType,
    trackUsage,
    refresh: fetchProjectTypes,
  };
};

