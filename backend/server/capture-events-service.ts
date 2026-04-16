import { and, asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  captureEvents,
  captureSessions,
  type CaptureEvent,
  type InsertCaptureEvent,
} from '../migrations/capture-schema.js';

type Db = NodePgDatabase<Record<string, never>>;

export async function appendEvents(
  db: Db,
  ownerUserId: string,
  sessionId: string,
  events: Array<{
    assetId?: string;
    eventType: string;
    metadata?: Record<string, unknown>;
    occurredAt: Date;
  }>,
  actorId: string,
): Promise<CaptureEvent[]> {
  // Verify session ownership once before bulk insert.
  const owns = await db
    .select({ id: captureSessions.id })
    .from(captureSessions)
    .where(
      and(eq(captureSessions.id, sessionId), eq(captureSessions.ownerUserId, ownerUserId)),
    )
    .limit(1);
  if (owns.length === 0) {
    return [];
  }

  const rows: InsertCaptureEvent[] = events.map((e) => ({
    sessionId,
    assetId: e.assetId,
    actorId,
    eventType: e.eventType,
    metadata: e.metadata ?? {},
    createdAt: e.occurredAt,
  }));
  return db.insert(captureEvents).values(rows).returning();
}

export async function listEvents(
  db: Db,
  ownerUserId: string,
  sessionId: string,
  limit = 1000,
): Promise<CaptureEvent[]> {
  const owns = await db
    .select({ id: captureSessions.id })
    .from(captureSessions)
    .where(
      and(eq(captureSessions.id, sessionId), eq(captureSessions.ownerUserId, ownerUserId)),
    )
    .limit(1);
  if (owns.length === 0) {
    return [];
  }
  return db
    .select()
    .from(captureEvents)
    .where(eq(captureEvents.sessionId, sessionId))
    .orderBy(asc(captureEvents.createdAt))
    .limit(limit);
}
