/**
 * useCollaboration Hook
 * React hook for real-time collaboration and conflict resolution
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  collaborationManager, 
  CollaborationConfig, 
  CollaborationState, 
  Collaborator,
  CollaborationEvent,
  ConflictResolution
} from '../utils/collaborationManager';

export interface UseCollaborationOptions {
  config?: Partial<CollaborationConfig>;
  onConnected?: (data: { user: Collaborator }) => void;
  onDisconnected?: () => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onEventSent?: (event: CollaborationEvent) => void;
  onEventReceived?: (event: CollaborationEvent) => void;
  onCursorUpdated?: (data: { userId: string; cursor: any }) => void;
  onPresenceUpdated?: (data: { userId: string; presence: any }) => void;
  onCommentUpdated?: (data: { elementId: string; comment: any }) => void;
  onVersionUpdated?: (data: { projectId: string; version: any }) => void;
  onPermissionUpdated?: (data: { userId: string; permission: any }) => void;
  onNotificationUpdated?: (data: { userId: string; notification: any }) => void;
  onConflictDetected?: (conflict: ConflictResolution) => void;
  onConflictResolved?: (conflict: ConflictResolution) => void;
  onSyncCompleted?: (data: { data: any }) => void;
  onOfflineSyncCompleted?: (data: { count: number }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void;
}

export interface UseCollaborationReturn {
  connect: (user: Collaborator) => Promise<void>;
  disconnect: () => Promise<void>;
  sendEvent: (event: CollaborationEvent) => Promise<void>;
  handleIncomingEvent: (event: CollaborationEvent) => void;
  resolveConflict: (conflictId: string, resolution: 'client' | 'server' | 'merge' | 'manual', resolvedData?: any) => Promise<void>;
  state: CollaborationState;
  config: CollaborationConfig;
  updateConfig: (config: Partial<CollaborationConfig>) => void;
  isEnabled: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
  hasError: boolean;
  error: string | null;
  collaborators: Collaborator[];
  currentUser: Collaborator | null;
  activeCursors: Map<string, any>;
  activeComments: Map<string, any>;
  activeVersions: Map<string, any>;
  activePermissions: Map<string, any>;
  activeNotifications: Map<string, any>;
  offlineQueue: any[];
  conflictQueue: ConflictResolution[];
  lastSync: number;
  connectionCount: number;
  messageCount: number;
  errorCount: number;
  conflictCount: number;
}

/**
 * Hook for collaboration functionality
 */
export const useCollaboration = (options: UseCollaborationOptions = {}): UseCollaborationReturn => {
  const {
    config = {},
    onConnected,
    onDisconnected,
    onReconnecting,
    onReconnected,
    onEventSent,
    onEventReceived,
    onCursorUpdated,
    onPresenceUpdated,
    onCommentUpdated,
    onVersionUpdated,
    onPermissionUpdated,
    onNotificationUpdated,
    onConflictDetected,
    onConflictResolved,
    onSyncCompleted,
    onOfflineSyncCompleted,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<CollaborationState>({
    isEnabled: false,
    isConnected: false,
    isReconnecting: false,
    hasError: false,
    error: null,
    collaborators: [],
    currentUser: null,
    activeCursors: new Map(),
    activeComments: new Map(),
    activeVersions: new Map(),
    activePermissions: new Map(),
    activeNotifications: new Map(),
    offlineQueue: [],
    conflictQueue: [],
    lastSync: 0,
    connectionCount: 0,
    messageCount: 0,
    errorCount: 0,
    conflictCount: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize collaboration manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      (collaborationManager as any).updateConfig(config);
  }

    // Setup event handlers
    const handleConnected = (data: { user: Collaborator }) => {
      if (onConnected) {
        onConnected(data);
    }
  };

    const handleDisconnected = () => {
      if (onDisconnected) {
        onDisconnected();
    }
  };

    const handleReconnecting = () => {
      if (onReconnecting) {
        onReconnecting();
    }
  };

    const handleReconnected = () => {
      if (onReconnected) {
        onReconnected();
    }
  };

    const handleEventSent = (event: CollaborationEvent) => {
      if (onEventSent) {
        onEventSent(event);
    }
  };

    const handleEventReceived = (event: CollaborationEvent) => {
      if (onEventReceived) {
        onEventReceived(event);
    }
  };

    const handleCursorUpdated = (data: { userId: string; cursor: any }) => {
      if (onCursorUpdated) {
        onCursorUpdated(data);
    }
  };

    const handlePresenceUpdated = (data: { userId: string; presence: any }) => {
      if (onPresenceUpdated) {
        onPresenceUpdated(data);
    }
  };

    const handleCommentUpdated = (data: { elementId: string; comment: any }) => {
      if (onCommentUpdated) {
        onCommentUpdated(data);
    }
  };

    const handleVersionUpdated = (data: { projectId: string; version: any }) => {
      if (onVersionUpdated) {
        onVersionUpdated(data);
    }
  };

    const handlePermissionUpdated = (data: { userId: string; permission: any }) => {
      if (onPermissionUpdated) {
        onPermissionUpdated(data);
    }
  };

    const handleNotificationUpdated = (data: { userId: string; notification: any }) => {
      if (onNotificationUpdated) {
        onNotificationUpdated(data);
    }
  };

    const handleConflictDetected = (conflict: ConflictResolution) => {
      if (onConflictDetected) {
        onConflictDetected(conflict);
    }
  };

    const handleConflictResolved = (conflict: ConflictResolution) => {
      if (onConflictResolved) {
        onConflictResolved(conflict);
    }
  };

    const handleSyncCompleted = (data: { data: any }) => {
      if (onSyncCompleted) {
        onSyncCompleted(data);
    }
  };

    const handleOfflineSyncCompleted = (data: { count: number }) => {
      if (onOfflineSyncCompleted) {
        onOfflineSyncCompleted(data);
    }
  };

    const handleError = (data: { error: string }) => {
      if (onError) {
        onError(data.error);
    }
  };

    const handleInitialized = () => {
      if (onInitialized) {
        onInitialized();
    }
  };

    // Store event handlers
    eventHandlersRef.current.set('connected', handleConnected);
    eventHandlersRef.current.set('disconnected', handleDisconnected);
    eventHandlersRef.current.set('reconnecting', handleReconnecting);
    eventHandlersRef.current.set('reconnected', handleReconnected);
    eventHandlersRef.current.set('event_sent', handleEventSent);
    eventHandlersRef.current.set('event_received', handleEventReceived);
    eventHandlersRef.current.set('cursor_updated', handleCursorUpdated);
    eventHandlersRef.current.set('presence_updated', handlePresenceUpdated);
    eventHandlersRef.current.set('comment_updated', handleCommentUpdated);
    eventHandlersRef.current.set('version_updated', handleVersionUpdated);
    eventHandlersRef.current.set('permission_updated', handlePermissionUpdated);
    eventHandlersRef.current.set('notification_updated', handleNotificationUpdated);
    eventHandlersRef.current.set('conflict_detected', handleConflictDetected);
    eventHandlersRef.current.set('conflict_resolved', handleConflictResolved);
    eventHandlersRef.current.set('sync_completed', handleSyncCompleted);
    eventHandlersRef.current.set('offline_sync_completed', handleOfflineSyncCompleted);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    (collaborationManager as any).on('connected', handleConnected);
    (collaborationManager as any).on('disconnected', handleDisconnected);
    (collaborationManager as any).on('reconnecting', handleReconnecting);
    (collaborationManager as any).on('reconnected', handleReconnected);
    (collaborationManager as any).on('event_sent', handleEventSent);
    (collaborationManager as any).on('event_received', handleEventReceived);
    (collaborationManager as any).on('cursor_updated', handleCursorUpdated);
    (collaborationManager as any).on('presence_updated', handlePresenceUpdated);
    (collaborationManager as any).on('comment_updated', handleCommentUpdated);
    (collaborationManager as any).on('version_updated', handleVersionUpdated);
    (collaborationManager as any).on('permission_updated', handlePermissionUpdated);
    (collaborationManager as any).on('notification_updated', handleNotificationUpdated);
    (collaborationManager as any).on('conflict_detected', handleConflictDetected);
    (collaborationManager as any).on('conflict_resolved', handleConflictResolved);
    (collaborationManager as any).on('sync_completed', handleSyncCompleted);
    (collaborationManager as any).on('offline_sync_completed', handleOfflineSyncCompleted);
    (collaborationManager as any).on('error', handleError);
    (collaborationManager as any).on('initialized', handleInitialized);

    // Update initial state
    setState((collaborationManager as any).getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        (collaborationManager as any).off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onConnected, onDisconnected, onReconnecting, onReconnected, onEventSent, onEventReceived, onCursorUpdated, onPresenceUpdated, onCommentUpdated, onVersionUpdated, onPermissionUpdated, onNotificationUpdated, onConflictDetected, onConflictResolved, onSyncCompleted, onOfflineSyncCompleted, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = (collaborationManager as any).getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Connect
  const connect = useCallback(async (user: Collaborator) => {
    await (collaborationManager as any).connect(user);
}, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    await (collaborationManager as any).disconnect();
}, []);

  // Send event
  const sendEvent = useCallback(async (event: CollaborationEvent) => {
    await (collaborationManager as any).sendEvent(event);
}, []);

  // Handle incoming event
  const handleIncomingEvent = useCallback((event: CollaborationEvent) => {
    (collaborationManager as any).handleIncomingEvent(event);
}, []);

  // Resolve conflict
  const resolveConflict = useCallback(async (conflictId: string, resolution: 'client' | 'server' | 'merge' |'manual', resolvedData?: any) => {
    await (collaborationManager as any).resolveConflict(conflictId, resolution, resolvedData);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<CollaborationConfig>) => {
    (collaborationManager as any).updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return (collaborationManager as any).getConfig();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    connect,
    disconnect,
    sendEvent,
    handleIncomingEvent,
    resolveConflict,
    state,
    config: currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    hasError: state.hasError,
    error: state.error,
    collaborators: state.collaborators,
    currentUser: state.currentUser,
    activeCursors: state.activeCursors,
    activeComments: state.activeComments,
    activeVersions: state.activeVersions,
    activePermissions: state.activePermissions,
    activeNotifications: state.activeNotifications,
    offlineQueue: state.offlineQueue,
    conflictQueue: state.conflictQueue,
    lastSync: state.lastSync,
    connectionCount: state.connectionCount,
    messageCount: state.messageCount,
    errorCount: state.errorCount,
    conflictCount: state.conflictCount
}), [
    connect,
    disconnect,
    sendEvent,
    handleIncomingEvent,
    resolveConflict,
    state,
    currentConfig,
    updateConfig
  ]);

  return returnValue as UseCollaborationReturn;
};

export default useCollaboration;





