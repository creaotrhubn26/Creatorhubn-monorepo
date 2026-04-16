import { and, asc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  captureAssets,
  captureSessions,
  type CaptureAsset,
  type AssetSignalsJson,
} from '../migrations/capture-schema.js';

type Db = NodePgDatabase<Record<string, never>>;

async function assertOwnsSession(
  db: Db,
  sessionId: string,
  ownerUserId: string,
): Promise<void> {
  const rows = await db
    .select({ id: captureSessions.id })
    .from(captureSessions)
    .where(
      and(eq(captureSessions.id, sessionId), eq(captureSessions.ownerUserId, ownerUserId)),
    )
    .limit(1);
  if (rows.length === 0) {
    throw new CaptureAuthzError('session not found or not owned by user');
  }
}

export class CaptureAuthzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaptureAuthzError';
  }
}

export async function registerAsset(
  db: Db,
  ownerUserId: string,
  sessionId: string,
  input: {
    originalFilename: string;
    captureTime: Date;
    mime: string;
    sizeBytes?: number;
  },
): Promise<CaptureAsset> {
  await assertOwnsSession(db, sessionId, ownerUserId);
  const [row] = await db
    .insert(captureAssets)
    .values({
      sessionId,
      originalFilename: input.originalFilename,
      captureTime: input.captureTime,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
    })
    .returning();
  return row;
}

export async function fetchAsset(
  db: Db,
  ownerUserId: string,
  assetId: string,
): Promise<CaptureAsset | null> {
  const rows = await db
    .select({ asset: captureAssets })
    .from(captureAssets)
    .innerJoin(captureSessions, eq(captureAssets.sessionId, captureSessions.id))
    .where(
      and(eq(captureAssets.id, assetId), eq(captureSessions.ownerUserId, ownerUserId)),
    )
    .limit(1);
  return rows[0]?.asset ?? null;
}

export async function listAssets(
  db: Db,
  ownerUserId: string,
  sessionId: string,
  limit = 500,
  offset = 0,
): Promise<CaptureAsset[]> {
  await assertOwnsSession(db, sessionId, ownerUserId);
  return db
    .select()
    .from(captureAssets)
    .where(eq(captureAssets.sessionId, sessionId))
    .orderBy(asc(captureAssets.captureTime))
    .limit(limit)
    .offset(offset);
}

export async function updateAssetLabels(
  db: Db,
  ownerUserId: string,
  assetId: string,
  patch: {
    rating?: number;
    colorLabel?: string | null;
    flaggedForClient?: boolean;
    rejected?: boolean;
  },
): Promise<CaptureAsset | null> {
  // Use a CTE-style authorization check via subquery.
  const [row] = await db
    .update(captureAssets)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(captureAssets.id, assetId),
        sql`EXISTS (SELECT 1 FROM ${captureSessions}
          WHERE ${captureSessions.id} = ${captureAssets.sessionId}
          AND ${captureSessions.ownerUserId} = ${ownerUserId})`,
      ),
    )
    .returning();
  return row ?? null;
}

export async function updateAssetSignals(
  db: Db,
  ownerUserId: string,
  assetId: string,
  signals: AssetSignalsJson,
): Promise<CaptureAsset | null> {
  const [row] = await db
    .update(captureAssets)
    .set({ signals, updatedAt: new Date() })
    .where(
      and(
        eq(captureAssets.id, assetId),
        sql`EXISTS (SELECT 1 FROM ${captureSessions}
          WHERE ${captureSessions.id} = ${captureAssets.sessionId}
          AND ${captureSessions.ownerUserId} = ${ownerUserId})`,
      ),
    )
    .returning();
  return row ?? null;
}
