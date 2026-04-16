import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { captureSessions, type CaptureSession } from '../migrations/capture-schema.js';

type Db = NodePgDatabase<Record<string, never>>;

export async function createSession(
  db: Db,
  input: {
    ownerUserId: string;
    name: string;
    clientId?: string;
    startsAt: Date;
  },
): Promise<CaptureSession> {
  const [row] = await db
    .insert(captureSessions)
    .values({
      ownerUserId: input.ownerUserId,
      name: input.name,
      clientId: input.clientId,
      startsAt: input.startsAt,
    })
    .returning();
  return row;
}

export async function fetchSession(
  db: Db,
  id: string,
  ownerUserId: string,
): Promise<CaptureSession | null> {
  const rows = await db
    .select()
    .from(captureSessions)
    .where(and(eq(captureSessions.id, id), eq(captureSessions.ownerUserId, ownerUserId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSessions(
  db: Db,
  ownerUserId: string,
  limit = 50,
  offset = 0,
): Promise<CaptureSession[]> {
  return db
    .select()
    .from(captureSessions)
    .where(eq(captureSessions.ownerUserId, ownerUserId))
    .orderBy(desc(captureSessions.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateSession(
  db: Db,
  id: string,
  ownerUserId: string,
  patch: Partial<Pick<CaptureSession, 'name' | 'endsAt' | 'status'>>,
): Promise<CaptureSession | null> {
  const [row] = await db
    .update(captureSessions)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(captureSessions.id, id), eq(captureSessions.ownerUserId, ownerUserId)))
    .returning();
  return row ?? null;
}

export async function softDeleteSession(
  db: Db,
  id: string,
  ownerUserId: string,
): Promise<boolean> {
  const [row] = await db
    .update(captureSessions)
    .set({ status: 'closed', endsAt: new Date(), updatedAt: new Date() })
    .where(and(eq(captureSessions.id, id), eq(captureSessions.ownerUserId, ownerUserId)))
    .returning({ id: captureSessions.id });
  return row !== undefined;
}
