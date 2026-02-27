export type RoleSyncEventType = 'pool-updated' | 'project-roles-updated' | 'pool-imported-to-project';

export interface RoleSyncEventPayload {
  type: RoleSyncEventType;
  projectId?: string;
  source?: 'role-management' | 'role-pool-panel' | 'system';
}

const ROLE_SYNC_EVENT_NAME = 'role-room:role-sync';

export function emitRoleSyncEvent(payload: RoleSyncEventPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<RoleSyncEventPayload>(ROLE_SYNC_EVENT_NAME, {
      detail: payload,
    }),
  );
}

export function onRoleSyncEvent(
  handler: (payload: RoleSyncEventPayload) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<RoleSyncEventPayload>;
    if (!customEvent.detail) return;
    handler(customEvent.detail);
  };

  window.addEventListener(ROLE_SYNC_EVENT_NAME, listener as EventListener);
  return () => window.removeEventListener(ROLE_SYNC_EVENT_NAME, listener as EventListener);
}
