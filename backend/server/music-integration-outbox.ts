import crypto from "crypto";
import {
  pushApprovedReferenceMixToEaseVerse,
  type EaseVerseProToolsSyncResult,
} from "./easeverse-protools-sync.js";
import type { PoolLike } from "./protools-companion-persistence.js";

export type ApprovedReferencePayload = Parameters<typeof pushApprovedReferenceMixToEaseVerse>[0];
export type MusicOutboxResult = EaseVerseProToolsSyncResult & { eventId: string; queued: boolean };

export async function ensureMusicOutboxSchema(pool: PoolLike): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS creatorhub_music_sync_outbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),event_id VARCHAR(240) NOT NULL UNIQUE,user_id VARCHAR(64) NOT NULL,
      source_id VARCHAR(160) NOT NULL,event_type VARCHAR(40) NOT NULL,payload JSONB NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending',attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),locked_at TIMESTAMPTZ,delivered_at TIMESTAMPTZ,
      dead_letter_at TIMESTAMPTZ,last_error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS creatorhub_music_sync_outbox_due_idx
      ON creatorhub_music_sync_outbox(status,next_attempt_at,locked_at,created_at);
  `);
}

async function deliver(pool: PoolLike, row: any): Promise<MusicOutboxResult> {
  const result = await pushApprovedReferenceMixToEaseVerse(row.payload as ApprovedReferencePayload);
  const attempt = Number(row.attempt_count || 0) + 1;
  if (result.synced) {
    await pool.query(
      `UPDATE creatorhub_music_sync_outbox SET status='delivered',attempt_count=$2,delivered_at=NOW(),locked_at=NULL,last_error=NULL,updated_at=NOW() WHERE id=$1`,
      [row.id, attempt],
    );
  } else {
    const status = attempt >= 12 ? "dead_letter" : "pending";
    const delay = Math.min(900, Math.max(5, 2 ** Math.min(attempt, 9)));
    const reason = result.reason || (result.status ? `http_${result.status}` : "unknown");
    await pool.query(
      `UPDATE creatorhub_music_sync_outbox SET status=$2,attempt_count=$3,next_attempt_at=NOW()+($4::text||' seconds')::interval,
         locked_at=NULL,last_error=$5,dead_letter_at=CASE WHEN $2='dead_letter' THEN NOW() ELSE dead_letter_at END,updated_at=NOW()
       WHERE id=$1`,
      [row.id, status, attempt, delay, reason.slice(0, 500)],
    );
  }
  return { ...result, eventId: String(row.event_id), queued: !result.synced };
}

export async function enqueueApprovedReferenceSync(args: {
  pool: PoolLike;
  userId: string;
  sourceId: string;
  eventId: string;
  payload: ApprovedReferencePayload;
}): Promise<MusicOutboxResult> {
  await ensureMusicOutboxSchema(args.pool);
  await args.pool.query(
    `INSERT INTO creatorhub_music_sync_outbox(event_id,user_id,source_id,event_type,payload)
     VALUES ($1,$2,$3,'approved_reference',$4::jsonb) ON CONFLICT(event_id) DO NOTHING`,
    [args.eventId.slice(0, 240), args.userId, args.sourceId.slice(0, 160), JSON.stringify(args.payload)],
  );
  const claimed = await args.pool.query(
    `UPDATE creatorhub_music_sync_outbox SET status='processing',locked_at=NOW(),updated_at=NOW()
      WHERE event_id=$1 AND status IN ('pending','processing')
        AND (locked_at IS NULL OR locked_at<NOW()-INTERVAL '5 minutes') RETURNING *`,
    [args.eventId.slice(0, 240)],
  );
  if (claimed.rows[0]) return deliver(args.pool, claimed.rows[0]);
  const existing = await args.pool.query(`SELECT status FROM creatorhub_music_sync_outbox WHERE event_id=$1`, [args.eventId.slice(0, 240)]);
  const synced = existing.rows[0]?.status === "delivered";
  return { configured: true, synced, queued: !synced, eventId: args.eventId };
}

export async function drainMusicOutbox(pool: PoolLike, limit = 25): Promise<{ attempted: number; delivered: number; pending: number }> {
  await ensureMusicOutboxSchema(pool);
  const lockToken = crypto.randomUUID();
  const claimed = await pool.query(
    `WITH due AS (
       SELECT id FROM creatorhub_music_sync_outbox
        WHERE (status='pending' AND next_attempt_at<=NOW()) OR (status='processing' AND locked_at<NOW()-INTERVAL '5 minutes')
        ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT $1
     )
     UPDATE creatorhub_music_sync_outbox o SET status='processing',locked_at=NOW(),last_error=COALESCE(last_error,$2),updated_at=NOW()
       FROM due WHERE o.id=due.id RETURNING o.*`,
    [Math.max(1, Math.min(100, limit)), `lease:${lockToken}`],
  );
  let delivered = 0;
  for (const row of claimed.rows) if ((await deliver(pool, row)).synced) delivered += 1;
  const pending = await pool.query(`SELECT COUNT(*)::int AS count FROM creatorhub_music_sync_outbox WHERE status IN ('pending','processing')`);
  return { attempted: claimed.rows.length, delivered, pending: Number(pending.rows[0]?.count || 0) };
}
