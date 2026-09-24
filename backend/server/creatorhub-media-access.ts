export const CREATORHUB_DOWNLOAD_WINDOW_DAYS = 30;

export type CreatorHubMediaAccessState = 'active' | 'download_only' | 'expired';

export interface CreatorHubMediaAccess {
  state: CreatorHubMediaAccessState;
  canCreate: boolean;
  canDownload: boolean;
  retentionGuaranteed: true;
  automaticDeletion: false;
  reason: string | null;
  downloadOnlyStartedAt: string | null;
  downloadOnlyUntil: string | null;
  daysRemaining: number | null;
}

type StartWindowInput = {
  userId: string;
  reason: 'payment_failed' | 'subscription_cancelled' | 'subscription_ended';
  source: string;
  sourceReference: string;
  effectiveAt?: Date;
};

function asIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function mapCreatorHubMediaAccess(row: Record<string, unknown> | null, now = new Date()): CreatorHubMediaAccess {
  if (!row || row.state !== 'download_only') {
    return {
      state: 'active', canCreate: true, canDownload: true,
      retentionGuaranteed: true, automaticDeletion: false,
      reason: null, downloadOnlyStartedAt: null, downloadOnlyUntil: null, daysRemaining: null,
    };
  }
  const untilIso = asIso(row.download_only_until);
  const until = untilIso ? new Date(untilIso) : null;
  const canDownload = Boolean(until && until.getTime() > now.getTime());
  return {
    state: canDownload ? 'download_only' : 'expired',
    canCreate: false,
    canDownload,
    retentionGuaranteed: true,
    automaticDeletion: false,
    reason: typeof row.reason === 'string' ? row.reason : null,
    downloadOnlyStartedAt: asIso(row.download_only_started_at),
    downloadOnlyUntil: untilIso,
    daysRemaining: until
      ? Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 86_400_000))
      : 0,
  };
}

export async function getCreatorHubMediaAccess(pool: any, userId: string, now = new Date()): Promise<CreatorHubMediaAccess> {
  const result = await pool.query(
    `SELECT state, reason, download_only_started_at, download_only_until
       FROM creatorhub_media_access_windows
      WHERE user_id=$1 LIMIT 1`,
    [userId],
  );
  return mapCreatorHubMediaAccess(result.rows[0] || null, now);
}

export async function startCreatorHubMediaDownloadWindow(pool: any, input: StartWindowInput): Promise<CreatorHubMediaAccess> {
  const effectiveAt = input.effectiveAt || new Date();
  const until = new Date(effectiveAt.getTime() + CREATORHUB_DOWNLOAD_WINDOW_DAYS * 86_400_000);
  const client = typeof pool.connect === 'function' ? await pool.connect() : pool;
  try {
    if (client !== pool) await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO creatorhub_media_access_windows
         (user_id, state, reason, download_only_started_at, download_only_until,
          restored_at, source, source_reference, updated_at)
       VALUES($1,'download_only',$2,$3,$4,NULL,$5,$6,now())
       ON CONFLICT (user_id) DO UPDATE SET
         state='download_only',
         reason=EXCLUDED.reason,
         download_only_started_at=CASE
           WHEN creatorhub_media_access_windows.state='active'
             THEN EXCLUDED.download_only_started_at
           ELSE creatorhub_media_access_windows.download_only_started_at
         END,
         download_only_until=CASE
           WHEN creatorhub_media_access_windows.state='active'
             THEN EXCLUDED.download_only_until
           ELSE LEAST(creatorhub_media_access_windows.download_only_until, EXCLUDED.download_only_until)
         END,
         restored_at=NULL,
         source=EXCLUDED.source,
         source_reference=EXCLUDED.source_reference,
         updated_at=now()
       RETURNING state, reason, download_only_started_at, download_only_until`,
      [input.userId, input.reason, effectiveAt, until, input.source, input.sourceReference],
    );
    const row = result.rows[0];
    await client.query(
      `INSERT INTO creatorhub_media_access_events
         (user_id,event_type,reason,source,source_reference,effective_at,download_only_until)
       VALUES($1,'download_window_started',$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [input.userId, input.reason, input.source, input.sourceReference, effectiveAt, row.download_only_until],
    );
    if (client !== pool) await client.query('COMMIT');
    return mapCreatorHubMediaAccess(row);
  } catch (error) {
    if (client !== pool) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (client !== pool) client.release();
  }
}

export async function restoreCreatorHubMediaAccess(pool: any, input: {
  userId: string;
  source: string;
  sourceReference: string;
  effectiveAt?: Date;
}): Promise<CreatorHubMediaAccess> {
  const effectiveAt = input.effectiveAt || new Date();
  const client = typeof pool.connect === 'function' ? await pool.connect() : pool;
  try {
    if (client !== pool) await client.query('BEGIN');
    const before = await client.query(
      `SELECT state FROM creatorhub_media_access_windows WHERE user_id=$1 FOR UPDATE`,
      [input.userId],
    );
    await client.query(
      `INSERT INTO creatorhub_media_access_windows
         (user_id,state,restored_at,source,source_reference,updated_at)
       VALUES($1,'active',$2,$3,$4,now())
       ON CONFLICT (user_id) DO UPDATE SET
         state='active', reason=NULL, download_only_started_at=NULL,
         download_only_until=NULL, restored_at=EXCLUDED.restored_at,
         source=EXCLUDED.source, source_reference=EXCLUDED.source_reference,
         updated_at=now()`,
      [input.userId, effectiveAt, input.source, input.sourceReference],
    );
    if (before.rows[0]?.state === 'download_only') {
      await client.query(
        `INSERT INTO creatorhub_media_access_events
           (user_id,event_type,source,source_reference,effective_at)
         VALUES($1,'access_restored',$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [input.userId, input.source, input.sourceReference, effectiveAt],
      );
    }
    if (client !== pool) await client.query('COMMIT');
    return mapCreatorHubMediaAccess(null);
  } catch (error) {
    if (client !== pool) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (client !== pool) client.release();
  }
}

export async function getProjectOwnerMediaAccess(pool: any, projectId: string): Promise<CreatorHubMediaAccess & { ownerUserId: string | null }> {
  const owner = await pool.query(`SELECT user_id FROM projects WHERE id::text=$1 LIMIT 1`, [projectId]);
  const ownerUserId = owner.rows[0]?.user_id ? String(owner.rows[0].user_id) : null;
  return ownerUserId
    ? { ...(await getCreatorHubMediaAccess(pool, ownerUserId)), ownerUserId }
    : { ...mapCreatorHubMediaAccess(null), ownerUserId: null };
}
