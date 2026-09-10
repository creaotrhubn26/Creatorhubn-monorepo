import crypto from "crypto";
import {
  pushProToolsSyncToEaseVerse,
  type EaseVerseProToolsSyncPayload,
  type EaseVerseProToolsSyncResult,
} from "./easeverse-protools-sync.js";
import { ensureMusicIntegrationSchema } from "./music-artifact-lineage.js";

export type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }>;
};

export type PoolLike = Queryable & {
  connect?: () => Promise<Queryable & { release: () => void }>;
};

export type PairingContext = {
  workspaceProjectId?: string;
  audioReviewProjectId?: string;
  easeverseTrackId?: string;
  projectName?: string;
};

export type PairingRecord = {
  userId: string;
  email: string;
  name: string;
  context: PairingContext;
};

export type QueuedSyncResult = EaseVerseProToolsSyncResult & {
  eventId: string;
  revision: number;
  queued: boolean;
};

const PAIR_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60_000;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function clean(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

export async function ensureProToolsCompanionSchema(pool: PoolLike): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS protools_companion_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR(64) NOT NULL, name TEXT NOT NULL,
      session_type VARCHAR(30) NOT NULL DEFAULT 'mixing', easeverse_track_id VARCHAR(160),
      audio_review_project_id UUID, tempo NUMERIC(7,3), key_signature VARCHAR(24), time_signature VARCHAR(12),
      sample_rate INTEGER, bit_depth INTEGER, session_format VARCHAR(8) DEFAULT 'ptx', ptx_path TEXT,
      bounce_dir TEXT, track_count INTEGER DEFAULT 0, tracks JSONB DEFAULT '[]'::jsonb, playhead JSONB,
      status VARCHAR(20) DEFAULT 'active', last_activity TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ptc_sessions_user ON protools_companion_sessions(user_id, last_activity DESC);
    CREATE INDEX IF NOT EXISTS idx_ptc_sessions_review ON protools_companion_sessions(audio_review_project_id);
    CREATE TABLE IF NOT EXISTS protools_companion_markers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL, name TEXT NOT NULL,
      start_seconds DOUBLE PRECISION NOT NULL, end_seconds DOUBLE PRECISION, timecode VARCHAR(24),
      color VARCHAR(16), order_index INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ptc_markers_session ON protools_companion_markers(session_id, order_index);
    CREATE TABLE IF NOT EXISTS protools_companion_bounces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL, file_name TEXT, file_url TEXT,
      storage_key TEXT, size_bytes BIGINT, duration_seconds DOUBLE PRECISION, review_version_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ptc_bounces_session ON protools_companion_bounces(session_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS protools_companion_pairing_codes (
      code_hash CHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, user_email TEXT NOT NULL, user_name TEXT,
      workspace_project_id VARCHAR(160), audio_review_project_id UUID, easeverse_track_id VARCHAR(160),
      context JSONB NOT NULL DEFAULT '{}'::jsonb, expires_at TIMESTAMPTZ NOT NULL, claimed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS protools_companion_rate_limits (
      scope VARCHAR(80) NOT NULL, subject_hash CHAR(64) NOT NULL, window_started_at TIMESTAMPTZ NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(scope,subject_hash,window_started_at)
    );
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS workspace_project_id VARCHAR(160);
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS organization_id VARCHAR(160);
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS integration_owner_user_id VARCHAR(64);
    UPDATE protools_companion_sessions SET integration_owner_user_id=user_id WHERE integration_owner_user_id IS NULL;
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS easeverse_project_id VARCHAR(160);
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS device_token_id VARCHAR(160);
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS last_easeverse_sync_at TIMESTAMPTZ;
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS last_easeverse_sync_status VARCHAR(24);
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS last_easeverse_sync_error TEXT;
    ALTER TABLE protools_companion_bounces ADD COLUMN IF NOT EXISTS client_event_id VARCHAR(240);
    ALTER TABLE protools_companion_bounces ADD COLUMN IF NOT EXISTS content_fingerprint VARCHAR(400);
    ALTER TABLE protools_companion_bounces ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ptc_bounces_session_event
      ON protools_companion_bounces(session_id,client_event_id) WHERE client_event_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS protools_easeverse_sync_outbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL, user_id VARCHAR(64) NOT NULL,
      event_id VARCHAR(240) NOT NULL UNIQUE, event_type VARCHAR(40) NOT NULL, revision BIGINT NOT NULL,
      payload JSONB NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'pending', attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), delivered_at TIMESTAMPTZ, last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ptc_easeverse_outbox_pending
      ON protools_easeverse_sync_outbox(status,next_attempt_at,created_at);
    ALTER TABLE protools_easeverse_sync_outbox ADD COLUMN IF NOT EXISTS lock_token UUID;
    ALTER TABLE protools_easeverse_sync_outbox ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
    ALTER TABLE protools_easeverse_sync_outbox ADD COLUMN IF NOT EXISTS dead_letter_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_ptc_easeverse_outbox_lease
      ON protools_easeverse_sync_outbox(status,next_attempt_at,locked_at,created_at);
    CREATE TABLE IF NOT EXISTS protools_companion_worker_heartbeat (
      worker_name VARCHAR(80) PRIMARY KEY, instance_id VARCHAR(160) NOT NULL,
      last_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_success_at TIMESTAMPTZ, last_error TEXT, processed_count BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await ensureMusicIntegrationSchema(pool);
}

export async function databaseRateLimited(
  pool: PoolLike,
  scope: string,
  subject: string,
  maxRequests = 10,
): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / RATE_WINDOW_MS) * RATE_WINDOW_MS);
  const result = await pool.query(
    `INSERT INTO protools_companion_rate_limits(scope,subject_hash,window_started_at,request_count)
     VALUES ($1,$2,$3,1)
     ON CONFLICT(scope,subject_hash,window_started_at) DO UPDATE SET
       request_count=protools_companion_rate_limits.request_count+1,updated_at=NOW()
     RETURNING request_count`,
    [scope.slice(0, 80), sha256(subject), windowStart],
  );
  if (Math.random() < 0.02) {
    void pool.query(`DELETE FROM protools_companion_rate_limits WHERE window_started_at < NOW()-INTERVAL '1 day'`).catch(() => undefined);
  }
  return Number(result.rows[0]?.request_count || 0) > maxRequests;
}

export async function createPairingCode(
  pool: PoolLike,
  user: { userId: string; email: string; name: string },
  context: PairingContext,
): Promise<{ code: string; expiresInSeconds: number }> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    try {
      await pool.query(
        `INSERT INTO protools_companion_pairing_codes
           (code_hash,user_id,user_email,user_name,workspace_project_id,audio_review_project_id,easeverse_track_id,context,expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [sha256(code), user.userId, user.email, user.name, context.workspaceProjectId ?? null,
         context.audioReviewProjectId ?? null, context.easeverseTrackId ?? null, JSON.stringify(context),
         new Date(Date.now() + PAIR_TTL_MS)],
      );
      return { code, expiresInSeconds: Math.floor(PAIR_TTL_MS / 1000) };
    } catch (error: any) {
      if (error?.code !== "23505") throw error;
    }
  }
  throw new Error("pairing_code_exhausted");
}

export async function claimPairingCode(pool: PoolLike, code: string): Promise<PairingRecord | null> {
  const result = await pool.query(
    `DELETE FROM protools_companion_pairing_codes
      WHERE code_hash=$1 AND claimed_at IS NULL AND expires_at>NOW()
      RETURNING user_id,user_email,user_name,workspace_project_id,audio_review_project_id,easeverse_track_id,context`,
    [sha256(code)],
  );
  const row = result.rows[0];
  if (!row) return null;
  const raw = row.context && typeof row.context === "object" ? row.context : {};
  return {
    userId: String(row.user_id),
    email: String(row.user_email),
    name: String(row.user_name || row.user_email),
    context: {
      workspaceProjectId: clean(row.workspace_project_id ?? raw.workspaceProjectId, 160),
      audioReviewProjectId: clean(row.audio_review_project_id ?? raw.audioReviewProjectId, 160),
      easeverseTrackId: clean(row.easeverse_track_id ?? raw.easeverseTrackId, 160),
      projectName: clean(raw.projectName, 200),
    },
  };
}

function retryDelaySeconds(attempt: number): number {
  return Math.min(15 * 60, Math.max(5, 2 ** Math.min(attempt, 9)));
}

async function deliverOutboxRow(pool: PoolLike, row: any): Promise<QueuedSyncResult> {
  const payload = row.payload as EaseVerseProToolsSyncPayload;
  const result = await pushProToolsSyncToEaseVerse(payload);
  const reason = result.reason || (result.status ? `http_${result.status}` : "unknown");
  if (result.synced) {
    await pool.query(
      `UPDATE protools_easeverse_sync_outbox SET status='delivered',attempt_count=attempt_count+1,
         delivered_at=NOW(),last_error=NULL,lock_token=NULL,locked_at=NULL,updated_at=NOW() WHERE id=$1`, [row.id],
    );
    if (row.session_id) {
      await pool.query(
        `UPDATE protools_companion_sessions SET last_easeverse_sync_at=NOW(),last_easeverse_sync_status='delivered',
           last_easeverse_sync_error=NULL WHERE id=$1::uuid`, [row.session_id],
      );
    }
  } else {
    const attempt = Number(row.attempt_count || 0) + 1;
    const nextAttempt = retryDelaySeconds(attempt);
    const nextStatus = attempt >= 12 ? "dead_letter" : "pending";
    await pool.query(
      `UPDATE protools_easeverse_sync_outbox SET status=$2,attempt_count=attempt_count+1,
         next_attempt_at=NOW()+($3::text||' seconds')::interval,last_error=$4,
         dead_letter_at=CASE WHEN $2='dead_letter' THEN NOW() ELSE dead_letter_at END,
         lock_token=NULL,locked_at=NULL,updated_at=NOW() WHERE id=$1`,
      [row.id, nextStatus, nextAttempt, reason.slice(0, 500)],
    );
    if (row.session_id) {
      await pool.query(
        `UPDATE protools_companion_sessions SET last_easeverse_sync_status=$2,last_easeverse_sync_error=$3
          WHERE id=$1::uuid`, [row.session_id, nextStatus, reason.slice(0, 500)],
      );
    }
  }
  return { ...result, eventId: String(row.event_id), revision: Number(row.revision), queued: !result.synced };
}

export async function enqueueEaseVerseSync(args: {
  pool: PoolLike;
  sessionId: string;
  userId: string;
  integrationOwnerUserId?: string;
  eventType: string;
  eventId?: string;
  payload: EaseVerseProToolsSyncPayload;
}): Promise<QueuedSyncResult> {
  const suppliedEventId = clean(args.eventId, 240);
  if (suppliedEventId) {
    const existing = await args.pool.query(
      `SELECT * FROM protools_easeverse_sync_outbox WHERE event_id=$1 AND session_id=$2::uuid AND user_id=$3 LIMIT 1`,
      [suppliedEventId, args.sessionId, args.userId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].status === "delivered") {
        return { configured: true, synced: true, eventId: suppliedEventId, revision: Number(existing.rows[0].revision), queued: false };
      }
      return deliverOutboxRow(args.pool, existing.rows[0]);
    }
  }
  const revisionResult = await args.pool.query(
    `UPDATE protools_companion_sessions SET sync_revision=sync_revision+1 WHERE id=$1::uuid AND user_id=$2 RETURNING sync_revision`,
    [args.sessionId, args.userId],
  );
  const revision = Number(revisionResult.rows[0]?.sync_revision || 0);
  const eventId = suppliedEventId ?? `ptc-${args.sessionId}-${revision}-${crypto.randomUUID()}`;
  const payload: EaseVerseProToolsSyncPayload = {
    ...args.payload,
    schemaVersion: 1,
    eventId,
    revision,
    ownerUserId: args.integrationOwnerUserId || args.userId,
    proToolsSessionId: args.sessionId,
  };
  const inserted = await args.pool.query(
    `INSERT INTO protools_easeverse_sync_outbox(session_id,user_id,event_id,event_type,revision,payload)
     VALUES ($1::uuid,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT(event_id) DO NOTHING
     RETURNING *`,
    [args.sessionId, args.userId, eventId, args.eventType.slice(0, 40), revision, JSON.stringify(payload)],
  );
  const row = inserted.rows[0] || (await args.pool.query(
    `SELECT * FROM protools_easeverse_sync_outbox WHERE event_id=$1 AND session_id=$2::uuid AND user_id=$3 LIMIT 1`,
    [eventId, args.sessionId, args.userId],
  )).rows[0];
  if (!row) throw new Error("easeverse_sync_outbox_conflict");
  if (row.status === "delivered") {
    return { configured: true, synced: true, eventId, revision: Number(row.revision), queued: false };
  }
  return deliverOutboxRow(args.pool, row);
}

export async function retryEaseVerseSync(
  pool: PoolLike,
  userId: string,
  limit = 10,
): Promise<{ attempted: number; delivered: number; pending: number }> {
  const rows = await pool.query(
    `SELECT * FROM protools_easeverse_sync_outbox
      WHERE user_id=$1 AND status='pending' AND next_attempt_at<=NOW()
      ORDER BY created_at ASC LIMIT $2`,
    [userId, Math.max(1, Math.min(25, limit))],
  );
  let delivered = 0;
  for (const row of rows.rows) {
    if ((await deliverOutboxRow(pool, row)).synced) delivered += 1;
  }
  const pending = await pool.query(
    `SELECT COUNT(*)::int AS count FROM protools_easeverse_sync_outbox WHERE user_id=$1 AND status='pending'`,
    [userId],
  );
  return { attempted: rows.rows.length, delivered, pending: Number(pending.rows[0]?.count || 0) };
}

export async function drainDueEaseVerseSync(
  pool: PoolLike,
  limit = 25,
): Promise<{ attempted: number; delivered: number; pending: number }> {
  const client = typeof pool.connect === "function" ? await pool.connect() : pool;
  const lockToken = crypto.randomUUID();
  let rows: any[] = [];
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `WITH due AS (
         SELECT id FROM protools_easeverse_sync_outbox
          WHERE ((status='pending' AND next_attempt_at<=NOW())
             OR (status='processing' AND locked_at<NOW()-INTERVAL '5 minutes'))
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
       )
       UPDATE protools_easeverse_sync_outbox o
          SET status='processing',lock_token=$2::uuid,locked_at=NOW(),updated_at=NOW()
         FROM due WHERE o.id=due.id
       RETURNING o.*`,
      [Math.max(1, Math.min(100, limit)), lockToken],
    );
    rows = claimed.rows;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    if (client !== pool && "release" in client) client.release();
  }

  let delivered = 0;
  for (const row of rows) {
    if ((await deliverOutboxRow(pool, row)).synced) delivered += 1;
  }
  const pendingResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM protools_easeverse_sync_outbox WHERE status IN ('pending','processing')`,
  );
  return { attempted: rows.length, delivered, pending: Number(pendingResult.rows[0]?.count || 0) };
}
