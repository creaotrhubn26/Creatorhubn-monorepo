import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { WorkspaceCategory } from '@shared/profession-types';
import { useUserEventStream, type RealtimeUserEvent } from '@/hooks/useUserEventStream';

export interface WorkspaceAccess {
  canRead: boolean;
  canEdit: boolean;
  isOwner: boolean;
}

export interface WorkspaceMember {
  id: string;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string;
  crewRole?: string | null;
  permissions?: { canRead?: boolean; canEdit?: boolean };
  status?: string;
  avatarUrl?: string | null;
}

export interface WorkspaceBootstrap {
  project: Record<string, any>;
  workspaceCategory: WorkspaceCategory;
  access: WorkspaceAccess;
  owner: WorkspaceMember | null;
  members: WorkspaceMember[];
}

interface WorkspaceContextValue {
  projectId: string;
  bootstrap: WorkspaceBootstrap | null;
  access: WorkspaceAccess;
  workspaceCategory: WorkspaceCategory;
  loading: boolean;
  error: string | null;
  realtimeConnected: boolean;
  refresh: () => Promise<void>;
}

const READ_ONLY_ACCESS: WorkspaceAccess = { canRead: true, canEdit: false, isOwner: false };

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WORKSPACE_UPDATED_EVENT = 'creatorhub:workspace-updated';
export const WORKSPACE_FULL_REFRESH_SCOPE = 'realtime.full-refresh';

export function notifyWorkspaceUpdated(
  projectId: string,
  scope?: string,
  event?: RealtimeUserEvent,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_UPDATED_EVENT, { detail: { projectId, scope, event } }));
}

export function useWorkspaceBootstrap(projectId: string) {
  const [bootstrap, setBootstrap] = useState<WorkspaceBootstrap | null>(null);
  const [loading, setLoading] = useState(projectId !== 'sample');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId || projectId === 'sample') {
      setBootstrap(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const payload = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/workspace-bootstrap`);
      setBootstrap(payload as WorkspaceBootstrap);
      setError(null);
    } catch (cause: any) {
      setBootstrap(null);
      setError(cause?.message || 'Kunne ikke laste prosjektarbeidsflaten');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail?.projectId === projectId && ['project.updated', 'team.updated', 'workspace.bootstrap'].includes(detail?.scope)) void refresh();
    };
    window.addEventListener(WORKSPACE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(WORKSPACE_UPDATED_EVENT, onUpdated);
  }, [projectId, refresh]);

  return { bootstrap, loading, error, refresh };
}

export const WorkspaceProvider: React.FC<{
  projectId: string;
  bootstrap: WorkspaceBootstrap | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  children: React.ReactNode;
}> = ({ projectId, bootstrap, loading, error, refresh, children }) => {
  const onRealtimeEvent = useCallback((event: RealtimeUserEvent) => {
    const belongsToProject = ('projectId' in event && event.projectId === projectId)
      || ('channelId' in event && event.channelId === `project-${projectId}`);
    if (!belongsToProject) return;
    notifyWorkspaceUpdated(projectId, event.kind, event);
  }, [projectId]);
  const onRealtimeReconnect = useCallback(() => {
    void refresh();
    notifyWorkspaceUpdated(projectId, WORKSPACE_FULL_REFRESH_SCOPE);
  }, [projectId, refresh]);
  const realtimeStatus = useUserEventStream({
    enabled: projectId !== 'sample' && bootstrap?.access.canRead === true,
    onEvent: onRealtimeEvent,
    onReconnect: onRealtimeReconnect,
  });

  const value = useMemo<WorkspaceContextValue>(() => ({
    projectId,
    bootstrap,
    access: bootstrap?.access || (projectId === 'sample'
      ? { canRead: true, canEdit: true, isOwner: true }
      : READ_ONLY_ACCESS),
    workspaceCategory: bootstrap?.workspaceCategory || 'service',
    loading,
    error,
    realtimeConnected: realtimeStatus === 'connected',
    refresh,
  }), [projectId, bootstrap, loading, error, realtimeStatus, refresh]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace må brukes innenfor WorkspaceProvider');
  return value;
}

export function useWorkspaceUpdate(
  projectId: string,
  scopes: string | string[],
  callback: (event?: RealtimeUserEvent) => void,
): void {
  const scopeKey = (Array.isArray(scopes) ? scopes : [scopes]).join('|');
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    const accepted = new Set(scopeKey.split('|'));
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail?.projectId !== projectId) return;
      if (detail?.scope === WORKSPACE_FULL_REFRESH_SCOPE || accepted.has(detail?.scope)) {
        callbackRef.current(detail?.event);
      }
    };
    window.addEventListener(WORKSPACE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(WORKSPACE_UPDATED_EVENT, onUpdated);
  }, [projectId, scopeKey]);
}
