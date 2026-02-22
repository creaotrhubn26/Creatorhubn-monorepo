/**
 * services/shotListEvents.ts
 *
 * Canonical event definitions for real-time ShotList collaboration.
 *
 * These are the ONLY four events that travel over the WebSocket.
 * Both the client (this file) and the server share the same payload shapes.
 *
 * Wire protocol:
 *   { type: ShotListEventType; payload: <corresponding payload>; meta: EventMeta }
 *
 * Receiving side should always check `meta.originUserId !== currentUserId`
 * before applying the event to local state (avoid echo loops).
 */

// ─── Event type enum ──────────────────────────────────────────────────────────

export const SHOT_LIST_EVENT = {
  /** A crew member was assigned to (or unassigned from) a shot. */
  ShotAssigned: 'ShotAssigned',
  /** A shot's status changed (not_started → in_progress → completed). */
  ShotStatusChanged: 'ShotStatusChanged',
  /** A new shot list was created for a scene. */
  ShotListCreated: 'ShotListCreated',
  /** Shots were reordered within a shot list. */
  ShotReordered: 'ShotReordered',
  /** A user started / stopped editing a shot (soft lock). */
  EditLockAcquired: 'EditLockAcquired',
  EditLockReleased: 'EditLockReleased',
  /** Heartbeat / presence: user is viewing this project. */
  UserPresence: 'UserPresence',
} as const;

export type ShotListEventType = typeof SHOT_LIST_EVENT[keyof typeof SHOT_LIST_EVENT];

// ─── Shared metadata attached to every event ─────────────────────────────────

export interface EventMeta {
  /** ISO timestamp of when the event was generated. */
  timestamp: string;
  /** User who triggered the event. */
  originUserId: string;
  /** Display name of the user (cached to avoid join at render time). */
  originUserName: string;
  /** Client-assigned idempotency key — skip if already seen. */
  eventId: string;
  /** The project this event belongs to (used as WS room key). */
  projectId: string;
}

// ─── Typed payloads ──────────────────────────────────────────────────────────

export interface ShotAssignedPayload {
  shotListId: string;
  shotId: string;
  /** null = unassigned */
  assigneeId: string | null;
  assigneeName: string | null;
}

export interface ShotStatusChangedPayload {
  shotListId: string;
  shotId: string;
  previousStatus: string;
  newStatus: string;
}

export interface ShotListCreatedPayload {
  shotListId: string;
  sceneId: string;
  sceneName: string;
}

export interface ShotReorderedPayload {
  shotListId: string;
  /** Ordered list of shot IDs reflecting the new order. */
  orderedShotIds: string[];
}

export interface EditLockAcquiredPayload {
  shotListId: string;
  shotId: string;
}

export interface EditLockReleasedPayload {
  shotListId: string;
  shotId: string;
}

export interface UserPresencePayload {
  status: 'active' | 'idle' | 'left';
}

// ─── Discriminated union for exhaustive handling ──────────────────────────────

export type ShotListEvent =
  | { type: 'ShotAssigned';      payload: ShotAssignedPayload;      meta: EventMeta }
  | { type: 'ShotStatusChanged'; payload: ShotStatusChangedPayload; meta: EventMeta }
  | { type: 'ShotListCreated';   payload: ShotListCreatedPayload;   meta: EventMeta }
  | { type: 'ShotReordered';     payload: ShotReorderedPayload;     meta: EventMeta }
  | { type: 'EditLockAcquired';  payload: EditLockAcquiredPayload;  meta: EventMeta }
  | { type: 'EditLockReleased';  payload: EditLockReleasedPayload;  meta: EventMeta }
  | { type: 'UserPresence';      payload: UserPresencePayload;      meta: EventMeta };

// ─── Audit log ───────────────────────────────────────────────────────────────

/** A human-readable record of every state-changing event. */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  /** Describes the action in plain language (locale = 'no'). */
  action: string;
  /** The event type that generated this entry. */
  eventType: ShotListEventType;
  /** Optional link back to the affected entities. */
  shotListId?: string;
  shotId?: string;
}

/**
 * Build a human-readable audit log entry from an event.
 * Returns null for non-auditable events (presence, lock).
 */
export function buildAuditEntry(event: ShotListEvent): AuditLogEntry | null {
  const { meta } = event;
  const base = {
    id:        meta.eventId,
    timestamp: meta.timestamp,
    userId:    meta.originUserId,
    userName:  meta.originUserName,
    eventType: event.type,
  };

  switch (event.type) {
    case 'ShotAssigned': {
      const { shotId, shotListId, assigneeName } = event.payload;
      return {
        ...base,
        shotListId,
        shotId,
        action: assigneeName
          ? `tilordnet shot til ${assigneeName}`
          : 'fjernet tilordning fra shot',
      };
    }
    case 'ShotStatusChanged': {
      const { shotListId, shotId, previousStatus, newStatus } = event.payload;
      const labels: Record<string, string> = {
        not_started: 'Venter', in_progress: 'Pågår', completed: 'Fullført',
      };
      return {
        ...base,
        shotListId,
        shotId,
        action: `endret status fra "${labels[previousStatus] ?? previousStatus}" til "${labels[newStatus] ?? newStatus}"`,
      };
    }
    case 'ShotListCreated': {
      const { shotListId, sceneName } = event.payload;
      return {
        ...base,
        shotListId,
        action: `opprettet shot list for scene "${sceneName}"`,
      };
    }
    case 'ShotReordered': {
      const { shotListId } = event.payload;
      return {
        ...base,
        shotListId,
        action: 'endret rekkefølgen på shots',
      };
    }
    // Non-auditable
    case 'EditLockAcquired':
    case 'EditLockReleased':
    case 'UserPresence':
      return null;
  }
}

// ─── Builder helpers (avoids constructing meta by hand) ──────────────────────

let _seq = 0;
function nextEventId(userId: string): string {
  return `${userId.slice(0, 8)}-${Date.now()}-${(++_seq).toString(36)}`;
}

export function makeEvent<T extends ShotListEventType>(
  type: T,
  payload: (ShotListEvent & { type: T })['payload'],
  meta: Omit<EventMeta, 'eventId' | 'timestamp'>,
): ShotListEvent & { type: T } {
  return {
    type,
    payload,
    meta: {
      ...meta,
      eventId:   nextEventId(meta.originUserId),
      timestamp: new Date().toISOString(),
    },
  } as ShotListEvent & { type: T };
}
