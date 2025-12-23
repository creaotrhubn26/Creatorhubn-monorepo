import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryKeys';

export type DraftType = 'social' | 'email' | 'announcement' | 'calendar_event';

export interface Draft {
  id: string;
  type: DraftType;
  title: string;
  content: any;
  version: number;
  lastSaved: string;
  autoSaveEnabled: boolean;
  metadata?: Record<string, any>;
}

export interface DraftVersion {
  id: string;
  draftId: string;
  version: number;
  content: any;
  createdAt: string;
  description?: string;
}

interface UseContentDraftsOptions {
  type: DraftType;
  autoSaveInterval?: number; // in milliseconds, default 30000 (30 seconds)
  enableAutoSave?: boolean;
  onSaveSuccess?: (draft: Draft) => void;
  onSaveError?: (error: Error) => void;
}

interface UseContentDraftsReturn {
  // Current draft state
  draft: Draft | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  
  // Draft operations
  createDraft: (title: string, content: any, metadata?: Record<string, any>) => Promise<Draft>;
  updateDraft: (content: any) => void;
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  deleteDraft: (draftId: string) => Promise<void>;
  
  // Version control
  versions: DraftVersion[];
  saveVersion: (description?: string) => Promise<void>;
  loadVersion: (versionId: string) => Promise<void>;
  
  // Auto-save control
  toggleAutoSave: () => void;
  isAutoSaveEnabled: boolean;
  
  // List operations
  allDrafts: Draft[];
  isLoadingDrafts: boolean;
}

export function useContentDrafts(options: UseContentDraftsOptions): UseContentDraftsReturn {
  const {
    type,
    autoSaveInterval = 30000,
    enableAutoSave = true,
    onSaveSuccess,
    onSaveError
  } = options;

  const queryClient = useQueryClient();
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(enableAutoSave);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<any>(null);

  // Query key for drafts
  const draftsQueryKey = [...QUERY_KEYS.DRAFTS, type];

  // Fetch all drafts for this type
  const { data: allDrafts = [], isLoading: isLoadingDrafts } = useQuery({
    queryKey: draftsQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/drafts?type=${type}`);
      if (!res.ok) throw new Error('Failed to fetch drafts');
      return res.json() as Promise<Draft[]>;
    }
  });

  // Fetch versions for current draft
  const { data: versions = [] } = useQuery({
    queryKey: [...QUERY_KEYS.DRAFT_VERSIONS, currentDraft?.id],
    queryFn: async () => {
      if (!currentDraft?.id) return [];
      const res = await fetch(`/api/drafts/${currentDraft.id}/versions`);
      if (!res.ok) throw new Error('Failed to fetch versions');
      return res.json() as Promise<DraftVersion[]>;
    },
    enabled: !!currentDraft?.id
  });

  // Save draft mutation
  const saveMutation = useMutation({
    mutationFn: async (draft: Partial<Draft>) => {
      const url = draft.id ? `/api/drafts/${draft.id}` : '/api/drafts';
      const method = draft.id ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(draft)
      });
      
      if (!res.ok) throw new Error('Failed to save draft');
      return res.json() as Promise<Draft>;
    },
    onSuccess: (savedDraft) => {
      setCurrentDraft(savedDraft);
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: draftsQueryKey });
      onSaveSuccess?.(savedDraft);
    },
    onError: (error: Error) => {
      onSaveError?.(error);
    }
  });

  // Delete draft mutation
  const deleteMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const res = await fetch(`/api/drafts/${draftId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete draft');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: draftsQueryKey });
      if (currentDraft) {
        setCurrentDraft(null);
        setIsDirty(false);
      }
    }
  });

  // Save version mutation
  const saveVersionMutation = useMutation({
    mutationFn: async ({ draftId, description }: { draftId: string; description?: string }) => {
      const res = await fetch(`/api/drafts/${draftId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          content: currentDraft?.content,
          description
        })
      });
      
      if (!res.ok) throw new Error('Failed to save version');
      return res.json() as Promise<DraftVersion>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.DRAFT_VERSIONS, currentDraft?.id] });
    }
  });

  // Load version mutation
  const loadVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await fetch(`/api/drafts/versions/${versionId}`);
      if (!res.ok) throw new Error('Failed to load version');
      return res.json() as Promise<DraftVersion>;
    },
    onSuccess: (version) => {
      if (currentDraft) {
        setCurrentDraft({
          ...currentDraft,
          content: version.content,
          version: version.version
        });
        setIsDirty(true);
      }
    }
  });

  // Auto-save effect
  useEffect(() => {
    if (isAutoSaveEnabled && isDirty && currentDraft) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, autoSaveInterval);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, isAutoSaveEnabled, currentDraft, autoSaveInterval]);

  // Create new draft
  const createDraft = useCallback(async (title: string, content: any, metadata?: Record<string, any>): Promise<Draft> => {
    const newDraft: Partial<Draft> = {
      type,
      title,
      content,
      metadata,
      version: 1,
      autoSaveEnabled: isAutoSaveEnabled,
      lastSaved: new Date().toISOString()
    };

    const result = await saveMutation.mutateAsync(newDraft);
    setCurrentDraft(result);
    contentRef.current = content;
    setIsDirty(false);
    return result;
  }, [type, isAutoSaveEnabled, saveMutation]);

  // Update draft content
  const updateDraft = useCallback((content: any) => {
    if (currentDraft) {
      contentRef.current = content;
      setCurrentDraft({
        ...currentDraft,
        content
      });
      setIsDirty(true);
    }
  }, [currentDraft]);

  // Save draft manually
  const saveDraft = useCallback(async () => {
    if (!currentDraft || !isDirty) return;

    await saveMutation.mutateAsync({
      ...currentDraft,
      content: contentRef.current,
      lastSaved: new Date().toISOString()
    });
  }, [currentDraft, isDirty, saveMutation]);

  // Load existing draft
  const loadDraft = useCallback(async (draftId: string) => {
    const res = await fetch(`/api/drafts/${draftId}`);
    if (!res.ok) throw new Error('Failed to load draft');
    const draft = await res.json() as Draft;
    
    setCurrentDraft(draft);
    contentRef.current = draft.content;
    setIsDirty(false);
    setIsAutoSaveEnabled(draft.autoSaveEnabled);
  }, []);

  // Delete draft
  const deleteDraft = useCallback(async (draftId: string) => {
    await deleteMutation.mutateAsync(draftId);
  }, [deleteMutation]);

  // Save version
  const saveVersion = useCallback(async (description?: string) => {
    if (!currentDraft?.id) return;
    await saveVersionMutation.mutateAsync({
      draftId: currentDraft.id,
      description
    });
  }, [currentDraft, saveVersionMutation]);

  // Load version
  const loadVersion = useCallback(async (versionId: string) => {
    await loadVersionMutation.mutateAsync(versionId);
  }, [loadVersionMutation]);

  // Toggle auto-save
  const toggleAutoSave = useCallback(() => {
    setIsAutoSaveEnabled(prev => !prev);
    if (currentDraft) {
      setCurrentDraft({
        ...currentDraft,
        autoSaveEnabled: !isAutoSaveEnabled
      });
      setIsDirty(true);
    }
  }, [currentDraft, isAutoSaveEnabled]);

  return {
    draft: currentDraft,
    isDirty,
    isSaving: saveMutation.isPending,
    lastSaved: currentDraft?.lastSaved ? new Date(currentDraft.lastSaved) : null,
    
    createDraft,
    updateDraft,
    saveDraft,
    loadDraft,
    deleteDraft,
    
    versions,
    saveVersion,
    loadVersion,
    
    toggleAutoSave,
    isAutoSaveEnabled,
    
    allDrafts,
    isLoadingDrafts
  };
}
