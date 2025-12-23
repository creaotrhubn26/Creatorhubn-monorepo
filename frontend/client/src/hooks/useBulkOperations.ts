import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryKeys';

export type BulkOperationType = 
  | 'delete' 
  | 'schedule' 
  | 'publish' 
  | 'archive' 
  | 'updateStatus' 
  | 'updateTags' 
  | 'assignTo'
  | 'duplicate';

export type ResourceType = 'social' | 'email' | 'announcement' | 'calendar_event' | 'template';

interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

interface UseBulkOperationsOptions {
  resourceType: ResourceType;
  onSuccess?: (result: BulkOperationResult) => void;
  onError?: (error: Error) => void;
}

interface UseBulkOperationsReturn {
  // Selection state
  selectedIds: string[];
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  toggleSelection: (id: string) => void;
  isSelected: (id: string) => boolean;
  
  // Bulk operations
  bulkDelete: () => Promise<BulkOperationResult>;
  bulkSchedule: (scheduleDate: string) => Promise<BulkOperationResult>;
  bulkPublish: () => Promise<BulkOperationResult>;
  bulkArchive: () => Promise<BulkOperationResult>;
  bulkUpdateStatus: (status: string) => Promise<BulkOperationResult>;
  bulkUpdateTags: (tags: string[]) => Promise<BulkOperationResult>;
  bulkAssignTo: (assigneeId: string) => Promise<BulkOperationResult>;
  bulkDuplicate: () => Promise<BulkOperationResult>;
  
  // State
  isProcessing: boolean;
  selectedCount: number;
}

export function useBulkOperations(options: UseBulkOperationsOptions): UseBulkOperationsReturn {
  const { resourceType, onSuccess, onError } = options;
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Get appropriate query key for resource type
  const getQueryKey = () => {
    switch (resourceType) {
      case 'social':
        return QUERY_KEYS.SOCIAL_POSTS;
      case 'email':
        return QUERY_KEYS.EMAIL_TEMPLATES;
      case 'announcement':
        return QUERY_KEYS.ANNOUNCEMENTS;
      case 'calendar_event':
        return QUERY_KEYS.CALENDAR_EVENTS;
      case 'template':
        return QUERY_KEYS.EMAIL_TEMPLATES;
      default:
        return [];
    }
  };

  // Get API endpoint for resource type
  const getEndpoint = () => {
    switch (resourceType) {
      case 'social':
        return '/api/social-media/posts';
      case 'email':
        return '/api/email-templates';
      case 'announcement':
        return '/api/announcements';
      case 'calendar_event':
        return '/api/content-calendar/events';
      case 'template':
        return '/api/email-templates';
      default:
        return '';
    }
  };

  // Generic bulk operation mutation
  const bulkOperationMutation = useMutation({
    mutationFn: async ({
      operation,
      ids,
      payload
    }: {
      operation: BulkOperationType;
      ids: string[];
      payload?: any;
    }) => {
      const endpoint = getEndpoint();
      const res = await fetch(`${endpoint}/bulk/${operation}`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ ids, ...payload })
      });

      if (!res.ok) throw new Error(`Bulk ${operation} failed`);
      return res.json() as Promise<BulkOperationResult>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey() });
      setSelectedIds([]);
      onSuccess?.(result);
    },
    onError: (error: Error) => {
      onError?.(error);
    }
  });

  // Selection methods
  const selectItem = useCallback((id: string) => {
    setSelectedIds(prev => [...new Set([...prev, id])]);
  }, []);

  const deselectItem = useCallback((id: string) => {
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(selectedId => selectedId !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedIds.includes(id);
  }, [selectedIds]);

  // Bulk operation methods
  const bulkDelete = useCallback(async (): Promise<BulkOperationResult> => {
    if (selectedIds.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const result = await bulkOperationMutation.mutateAsync({
      operation: 'delete',
      ids: selectedIds
    });

    return result;
  }, [selectedIds, bulkOperationMutation]);

  const bulkSchedule = useCallback(async (scheduleDate: string): Promise<BulkOperationResult> => {
    if (selectedIds.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const result = await bulkOperationMutation.mutateAsync({
      operation: 'schedule',
      ids: selectedIds,
      payload: { scheduleDate }
    });

    return result;
  }, [selectedIds, bulkOperationMutation]);

  const bulkPublish = useCallback(async (): Promise<BulkOperationResult> => {
    if (selectedIds.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const result = await bulkOperationMutation.mutateAsync({
      operation: 'publish',
      ids: selectedIds
    });

    return result;
  }, [selectedIds, bulkOperationMutation]);

  const bulkArchive = useCallback(async (): Promise<BulkOperationResult> => {
    if (selectedIds.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const result = await bulkOperationMutation.mutateAsync({
      operation: 'archive',
      ids: selectedIds
    });

    return result;
  }, [selectedIds, bulkOperationMutation]);

  const bulkUpdateStatus = useCallback(async (status: string): Promise<BulkOperationResult> => {
    if (selectedIds.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const result = await bulkOperationMutation.mutateAsync({
      operation: 'updateStatus',
      ids: selectedIds,
      payload: { status }
    });

    return result;
  }, [selectedIds, bulkOperationMutation]);

  const bulkUpdateTags = useCallback(async (tags: string[]): Promise<BulkOperationResult> => {
    if (selectedIds.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const result = await bulkOperationMutation.mutateAsync({
      operation: 'updateTags',
      ids: selectedIds,
      payload: { tags }
    });

    return result;
  }, [selectedIds, bulkOperationMutation]);

  const bulkAssignTo = useCallback(async (assigneeId: string): Promise<BulkOperationResult> => {
    if (selectedIds.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const result = await bulkOperationMutation.mutateAsync({
      operation: 'assignTo',
      ids: selectedIds,
      payload: { assigneeId }
    });

    return result;
  }, [selectedIds, bulkOperationMutation]);

  const bulkDuplicate = useCallback(async (): Promise<BulkOperationResult> => {
    if (selectedIds.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const result = await bulkOperationMutation.mutateAsync({
      operation: 'duplicate',
      ids: selectedIds
    });

    return result;
  }, [selectedIds, bulkOperationMutation]);

  return {
    selectedIds,
    selectItem,
    deselectItem,
    selectAll,
    deselectAll,
    toggleSelection,
    isSelected,

    bulkDelete,
    bulkSchedule,
    bulkPublish,
    bulkArchive,
    bulkUpdateStatus,
    bulkUpdateTags,
    bulkAssignTo,
    bulkDuplicate,

    isProcessing: bulkOperationMutation.isPending,
    selectedCount: selectedIds.length
  };
}
