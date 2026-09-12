import { describe, expect, it, vi } from 'vitest';
import { upsertProducerProjectNotification } from './role-room-producer-notifications.js';

type QueryImpl = (sql: string, params: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;

function makePool(impl: QueryImpl) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return impl(sql, params);
  });
  return { pool: { query } as never, calls };
}

describe('upsertProducerProjectNotification', () => {
  it('atomically upserts a notification by its dedup key', async () => {
    const { pool, calls } = makePool(async (sql) => {
      if (sql.includes('RETURNING id')) return { rows: [{ id: 'notification-1' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    await upsertProducerProjectNotification(pool, {
      projectId: 'p1',
      audience: 'producer_team',
      eventType: 'client_request_reply',
      title: 'Klient svarte',
      linkedEntityType: 'client_request',
      linkedEntityId: 'req-1',
    });
    const insert = calls.find((c) => c.sql.includes('INSERT INTO role_room_project_notifications'));
    expect(insert).toBeDefined();
    expect(insert?.sql).toContain('ON CONFLICT');
    expect(calls.some((c) => c.sql.includes('DELETE FROM role_room_project_notification_reads'))).toBe(true);
  });

  it('uses the database uniqueness contract instead of a racy SELECT then INSERT', async () => {
    const { pool, calls } = makePool(async (sql) => {
      if (sql.includes('RETURNING id')) return { rows: [{ id: 'existing-1' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    await upsertProducerProjectNotification(pool, {
      projectId: 'p1',
      audience: 'producer_team',
      eventType: 'client_post_approved',
      title: 'Klient godkjente',
      linkedEntityType: 'marketing_plan_post',
      linkedEntityId: 'post-1',
    });
    expect(calls.filter((c) => c.sql.includes('INSERT INTO role_room_project_notifications'))).toHaveLength(1);
    expect(calls.some((c) => c.sql.startsWith('SELECT id'))).toBe(false);
    // Lest-status nullstilles ved oppdatering så den dukker opp som ulest.
    expect(calls.some((c) => c.sql.includes('DELETE FROM role_room_project_notification_reads'))).toBe(true);
  });

  it('persists mention_user_ids on the inserted row', async () => {
    const { pool, calls } = makePool(async (sql) => {
      if (sql.includes('RETURNING id')) return { rows: [{ id: 'notification-2' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    await upsertProducerProjectNotification(pool, {
      projectId: 'p1',
      audience: 'producer_team',
      eventType: 'editor_comment_mention',
      title: 'Du ble nevnt',
      mentionUserIds: ['u2', 'u3'],
    });
    const insert = calls.find((c) => c.sql.includes('INSERT INTO role_room_project_notifications'));
    expect(insert).toBeDefined();
    expect(JSON.stringify(insert!.params)).toContain('u2');
    expect(JSON.stringify(insert!.params)).toContain('u3');
  });

  it('never throws when the DB query fails (best-effort)', async () => {
    const { pool } = makePool(async () => {
      throw new Error('db down');
    });
    await expect(
      upsertProducerProjectNotification(pool, {
        projectId: 'p1',
        audience: 'producer_team',
        eventType: 'client_request_reply',
        title: 'x',
      }),
    ).resolves.toBeUndefined();
  });
});
