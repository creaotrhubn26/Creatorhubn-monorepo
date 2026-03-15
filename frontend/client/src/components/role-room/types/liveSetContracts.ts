export type LiveSetEventType =
  | 'roll'
  | 'cut'
  | 'capture_take'
  | 'set_take_status'
  | 'add_flag'
  | 'add_note'
  | 'update_note'
  | 'delete_note'
  | 'set_scene'
  | 'setup_complete'
  | 'advance_scene'
  | 'set_camera'
  | 'set_setup'
  | 'set_cam'
  | 'quick_action';

export interface LiveSetEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  sessionId: string;
  seq: number;
  type: LiveSetEventType;
  payload: TPayload;
  capturedAt: string;
  deviceId: string;
  operatorId: string;
  projectId: string;
  shootingDayId?: string;
}

export interface LiveSetSession {
  sessionId: string;
  projectId: string;
  operatorId: string;
  deviceId: string;
  shootingDayId?: string;
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface LiveSetConflictRecord {
  eventId?: string;
  sessionId?: string;
  seq?: number;
  type: string;
  reason: string;
  serverValue?: unknown;
  clientValue?: unknown;
  resolvedBy?: 'server' | 'client' | 'merge';
  timestamp?: string;
}

export interface LiveSetRejectedEvent {
  eventId: string;
  reason: string;
  code?: string;
}

export interface LiveSetBatchIngestRequest {
  sessionId: string;
  events: LiveSetEvent[];
}

export interface LiveSetBatchIngestResponse {
  success: boolean;
  ackedEventIds: string[];
  rejected: LiveSetRejectedEvent[];
  conflicts: LiveSetConflictRecord[];
  serverTime: string;
}

export interface LiveSetEventsSinceResponse {
  success: boolean;
  events: LiveSetEvent[];
  conflicts: LiveSetConflictRecord[];
  serverCursor?: string;
}

export interface LiveSetAckRequest {
  sessionId: string;
  eventIds: string[];
}

export interface LiveSetAckResponse {
  success: boolean;
  ackedEventIds: string[];
  unknownEventIds?: string[];
}

export interface LiveSetSyncQueueItem {
  eventId: string;
  sessionId: string;
  projectId: string;
  seq: number;
  type: LiveSetEventType;
  payload: Record<string, unknown>;
  capturedAt: string;
  deviceId: string;
  operatorId: string;
  shootingDayId?: string;
  status: 'pending' | 'syncing' | 'acked' | 'failed';
  attempts: number;
  nextRetryAt?: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WeatherAlertNormalized {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  title: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  recommendedAction?: string;
  blockingRisk?: boolean;
}

export interface LiveSetHealthResponse {
  success: boolean;
  status: 'ok' | 'degraded' | 'down';
  dependencies: {
    db: 'ok' | 'degraded' | 'down';
    weatherUpstream: 'ok' | 'degraded' | 'down';
    websocket: 'ok' | 'degraded' | 'down';
  };
  timestamp: string;
}
