/**
 * Custom hook for Page Customizations
 * Fetches and manages page customizations from the visual editor API
 * Used by landing pages, dashboards, and other customizable pages
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

// Types for page customizations
export interface PageSection {
  id: string;
  title?: string;
  subtitle?: string;
  content?: string;
  items?: any[];
  styles?: Record<string, any>;
  visible?: boolean;
  [key: string]: any;
}

export interface PageStyles {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  typography?: {
    headingFont?: string;
    bodyFont?: string;
    headingSize?: string;
    bodySize?: string;
  };
  spacing?: {
    sectionPadding?: string;
    containerMaxWidth?: string;
  };
  [key: string]: any;
}

export interface WiringConnection {
  id: string;
  from: {
    nodeId: string;
    port: string;
  };
  to: {
    nodeId: string;
    port: string;
  };
  type: 'data' | 'event' | 'hook' | 'icon' | 'style' | 'i18n' | 'validation';
  config?: Record<string, any>;
}

export interface PageCustomizations {
  pageId: string;
  pageType: string;
  sections: Record<string, PageSection>;
  styles: PageStyles;
  wiringConnections: WiringConnection[];
  nodePositions: Record<string, { x: number; y: number }>;
  metadata: Record<string, any>;
  isPublished: boolean;
  publishedAt?: string;
  publishedBy?: string;
  draftSections?: Record<string, PageSection>;
  draftStyles?: PageStyles;
  draftWiring?: WiringConnection[];
  createdAt?: string;
  updatedAt?: string;
}

// API helper function
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Hook for fetching published page customizations (public)
 */
export function usePublishedPageCustomizations(pageId: string) {
  return useQuery({
    queryKey: ['page-customizations', 'published', pageId],
    queryFn: () => apiRequest<PageCustomizations>(`/api/pages/${pageId}/published`),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    enabled: !!pageId,
  });
}

/**
 * Hook for fetching page customizations for editing (admin)
 */
export function useAdminPageCustomizations(pageId: string) {
  return useQuery({
    queryKey: ['page-customizations', 'admin', pageId],
    queryFn: () => apiRequest<PageCustomizations>(`/api/admin/pages/${pageId}/customizations`),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    enabled: !!pageId,
  });
}

/**
 * Hook for saving page customizations
 */
export function useSavePageCustomizations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pageId,
      customizations,
      saveAsDraft = true,
    }: {
      pageId: string;
      customizations: Partial<PageCustomizations>;
      saveAsDraft?: boolean;
    }) => {
      return apiRequest(`/api/admin/pages/${pageId}/customizations`, {
        method: 'PUT',
        body: JSON.stringify({
          ...customizations,
          saveAsDraft,
        }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['page-customizations', 'admin', variables.pageId],
      });
    },
  });
}

/**
 * Hook for publishing page customizations
 */
export function usePublishPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pageId: string) => {
      return apiRequest(`/api/admin/pages/${pageId}/publish`, {
        method: 'POST',
      });
    },
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({
        queryKey: ['page-customizations', 'admin', pageId],
      });
      queryClient.invalidateQueries({
        queryKey: ['page-customizations', 'published', pageId],
      });
    },
  });
}

/**
 * Hook for unpublishing a page
 */
export function useUnpublishPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pageId: string) => {
      return apiRequest(`/api/admin/pages/${pageId}/unpublish`, {
        method: 'POST',
      });
    },
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({
        queryKey: ['page-customizations', 'admin', pageId],
      });
      queryClient.invalidateQueries({
        queryKey: ['page-customizations', 'published', pageId],
      });
    },
  });
}

/**
 * Main hook for page customizations - combines fetching and saving
 */
export function usePageCustomizations(pageId: string, isAdmin = false) {
  const queryClient = useQueryClient();

  // Fetch customizations
  const {
    data: customizations,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['page-customizations', isAdmin ? 'admin' : 'published', pageId],
    queryFn: () =>
      isAdmin
        ? apiRequest<PageCustomizations>(`/api/admin/pages/${pageId}/customizations`)
        : apiRequest<PageCustomizations>(`/api/pages/${pageId}/published`),
    staleTime: isAdmin ? 30 * 1000 : 5 * 60 * 1000,
    gcTime: isAdmin ? 5 * 60 * 1000 : 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!pageId,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      sections,
      styles,
      wiringConnections,
      nodePositions,
      metadata,
      saveAsDraft = true,
    }: Partial<PageCustomizations> & { saveAsDraft?: boolean }) => {
      return apiRequest(`/api/admin/pages/${pageId}/customizations`, {
        method: 'PUT',
        body: JSON.stringify({
          pageType: customizations?.pageType || 'landing',
          sections,
          styles,
          wiringConnections,
          nodePositions,
          metadata,
          saveAsDraft,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['page-customizations', 'admin', pageId],
      });
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/admin/pages/${pageId}/publish`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['page-customizations', 'admin', pageId],
      });
      queryClient.invalidateQueries({
        queryKey: ['page-customizations', 'published', pageId],
      });
    },
  });

  // Helper to get section content with fallback
  const getSection = useCallback(
    (sectionId: string, fallback?: PageSection): PageSection | undefined => {
      if (!customizations?.sections) return fallback;
      return customizations.sections[sectionId] || fallback;
    },
    [customizations]
  );

  // Helper to get style value with fallback
  const getStyle = useCallback(
    <T>(path: string, fallback?: T): T | undefined => {
      if (!customizations?.styles) return fallback;
      const parts = path.split('.');
      let value: any = customizations.styles;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) return fallback;
      }
      return value as T;
    },
    [customizations]
  );

  // Merged styles helper
  const mergedStyles = useMemo(() => {
    const defaultStyles: PageStyles = {
      colors: {
        primary: '#ff6b00',
        secondary: '#1a1a2e',
        accent: '#ffa500',
        background: '#0f0f1a',
        text: '#ffffff',
      },
      typography: {
        headingFont: 'Inter, sans-serif',
        bodyFont: 'Inter, sans-serif',
      },
      spacing: {
        sectionPadding: '80px',
        containerMaxWidth: '1200px',
      },
    };

    return {
      ...defaultStyles,
      ...customizations?.styles,
      colors: {
        ...defaultStyles.colors,
        ...customizations?.styles?.colors,
      },
      typography: {
        ...defaultStyles.typography,
        ...customizations?.styles?.typography,
      },
      spacing: {
        ...defaultStyles.spacing,
        ...customizations?.styles?.spacing,
      },
    };
  }, [customizations?.styles]);

  return {
    // Data
    customizations,
    sections: customizations?.sections || {},
    styles: mergedStyles,
    wiringConnections: customizations?.wiringConnections || [],
    nodePositions: customizations?.nodePositions || {},
    metadata: customizations?.metadata || {},
    isPublished: customizations?.isPublished || false,

    // Loading states
    isLoading,
    isSaving: saveMutation.isPending,
    isPublishing: publishMutation.isPending,

    // Errors
    error,
    saveError: saveMutation.error,
    publishError: publishMutation.error,

    // Actions
    save: saveMutation.mutate,
    saveAsync: saveMutation.mutateAsync,
    publish: publishMutation.mutate,
    publishAsync: publishMutation.mutateAsync,
    refetch,

    // Helpers
    getSection,
    getStyle,
  };
}

/**
 * Hook for managing nodes on a page
 */
export function usePageNodes(pageId: string) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['page-nodes', pageId],
    queryFn: () => apiRequest<{ nodes: any[] }>(`/api/admin/pages/${pageId}/nodes`),
    enabled: !!pageId,
    staleTime: 30 * 1000,
  });

  const saveNodeMutation = useMutation({
    mutationFn: async ({ nodeId, ...nodeData }: { nodeId: string; [key: string]: any }) => {
      return apiRequest(`/api/admin/pages/${pageId}/nodes/${nodeId}`, {
        method: 'PUT',
        body: JSON.stringify(nodeData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-nodes', pageId] });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      return apiRequest(`/api/admin/pages/${pageId}/nodes/${nodeId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-nodes', pageId] });
    },
  });

  return {
    nodes: data?.nodes || [],
    isLoading,
    error,
    saveNode: saveNodeMutation.mutate,
    deleteNode: deleteNodeMutation.mutate,
    isSaving: saveNodeMutation.isPending,
    isDeleting: deleteNodeMutation.isPending,
  };
}

/**
 * Hook for managing connections on a page
 */
export function usePageConnections(pageId: string) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['page-connections', pageId],
    queryFn: () => apiRequest<{ connections: WiringConnection[] }>(`/api/admin/pages/${pageId}/connections`),
    enabled: !!pageId,
    staleTime: 30 * 1000,
  });

  const saveConnectionMutation = useMutation({
    mutationFn: async ({ connectionId, ...connectionData }: WiringConnection) => {
      return apiRequest(`/api/admin/pages/${pageId}/connections/${connectionId}`, {
        method: 'PUT',
        body: JSON.stringify(connectionData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-connections', pageId] });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest(`/api/admin/pages/${pageId}/connections/${connectionId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-connections', pageId] });
    },
  });

  return {
    connections: data?.connections || [],
    isLoading,
    error,
    saveConnection: saveConnectionMutation.mutate,
    deleteConnection: deleteConnectionMutation.mutate,
    isSaving: saveConnectionMutation.isPending,
    isDeleting: deleteConnectionMutation.isPending,
  };
}

export default usePageCustomizations;

