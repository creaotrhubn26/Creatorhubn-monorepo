import { and, asc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  captureAssets,
  captureReviews,
  captureSessions,
  type CaptureReview,
} from '../migrations/capture-schema.js';

type Db = NodePgDatabase<Record<string, never>>;

async function canReviewAsset(
  db: Db,
  assetId: string,
  reviewerId: string,
  reviewerType: 'photographer' | 'client' | 'assistant',
): Promise<boolean> {
  if (reviewerType === 'client') {
    // Client reviews carry their own scoped token — caller already validated it.
    return true;
  }
  const rows = await db
    .select({ id: captureSessions.id })
    .from(captureAssets)
    .innerJoin(captureSessions, eq(captureAssets.sessionId, captureSessions.id))
    .where(and(eq(captureAssets.id, assetId), eq(captureSessions.ownerUserId, reviewerId)))
    .limit(1);
  return rows.length > 0;
}

export async function addReview(
  db: Db,
  input: {
    assetId: string;
    reviewerId: string;
    reviewerType: 'photographer' | 'client' | 'assistant';
    heart?: boolean;
    rating?: number;
    comment?: string;
    audioKey?: string;
    audioDurationSeconds?: number;
    audioMimeType?: string;
  },
): Promise<CaptureReview | null> {
  const allowed = await canReviewAsset(db, input.assetId, input.reviewerId, input.reviewerType);
  if (!allowed) {
    return null;
  }
  const [row] = await db
    .insert(captureReviews)
    .values({
      assetId: input.assetId,
      reviewerId: input.reviewerId,
      reviewerType: input.reviewerType,
      heart: input.heart,
      rating: input.rating,
      comment: input.comment,
      audioKey: input.audioKey,
      audioDurationSeconds: input.audioDurationSeconds,
      audioMimeType: input.audioMimeType,
    })
    .returning();
  return row;
}

export async function listReviews(
  db: Db,
  ownerUserId: string,
  assetId: string,
): Promise<CaptureReview[]> {
  const owns = await db
    .select({ id: captureSessions.id })
    .from(captureAssets)
    .innerJoin(captureSessions, eq(captureAssets.sessionId, captureSessions.id))
    .where(and(eq(captureAssets.id, assetId), eq(captureSessions.ownerUserId, ownerUserId)))
    .limit(1);
  if (owns.length === 0) {
    return [];
  }
  return db
    .select()
    .from(captureReviews)
    .where(eq(captureReviews.assetId, assetId))
    .orderBy(asc(captureReviews.createdAt));
}
