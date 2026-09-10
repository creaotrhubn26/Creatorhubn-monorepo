import crypto from "crypto";
import {
  drainDueEaseVerseSync,
  ensureProToolsCompanionSchema,
  type PoolLike,
} from "./protools-companion-persistence.js";
import { drainMusicOutbox, ensureMusicOutboxSchema } from "./music-integration-outbox.js";

const DEFAULT_INTERVAL_MS = 15_000;

export type ProToolsSyncWorker = { stop: () => void };

/**
 * Durable outbox worker. Database leases make this safe across multiple Render
 * instances, and the heartbeat gives deploy/health checks an explicit signal.
 */
export function startProToolsSyncWorker(
  pool: PoolLike,
  intervalMs = DEFAULT_INTERVAL_MS,
): ProToolsSyncWorker {
  const instanceId = `${process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || "local"}-${crypto.randomUUID()}`;
  let running = false;
  let stopped = false;

  const heartbeat = async (fields: { success?: boolean; error?: string; processed?: number } = {}) => {
    await pool.query(
      `INSERT INTO protools_companion_worker_heartbeat
         (worker_name,instance_id,last_started_at,last_heartbeat_at,last_success_at,last_error,processed_count,updated_at)
       VALUES ('easeverse-sync',$1,NOW(),NOW(),CASE WHEN $2 THEN NOW() ELSE NULL END,$3,$4,NOW())
       ON CONFLICT(worker_name) DO UPDATE SET
         instance_id=EXCLUDED.instance_id,last_heartbeat_at=NOW(),
         last_success_at=CASE WHEN $2 THEN NOW() ELSE protools_companion_worker_heartbeat.last_success_at END,
         last_error=$3,processed_count=protools_companion_worker_heartbeat.processed_count+$4,updated_at=NOW()`,
      [instanceId, fields.success === true, fields.error?.slice(0, 1000) || null, fields.processed || 0],
    );
  };

  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await ensureProToolsCompanionSchema(pool);
      await ensureMusicOutboxSchema(pool);
      const [sessionSync, musicSync] = await Promise.all([
        drainDueEaseVerseSync(pool, 25),
        drainMusicOutbox(pool, 25),
      ]);
      await heartbeat({ success: true, processed: sessionSync.attempted + musicSync.attempted });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[protools-sync-worker] tick failed:", message);
      await heartbeat({ error: message }).catch(() => undefined);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), Math.max(1_000, intervalMs));
  timer.unref?.();
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
