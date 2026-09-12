import { describe, expect, it, vi } from 'vitest';
import {
  createDeliverable,
  updateDeliverable,
  normalizeStatus,
} from './role-room-deliverables.js';

type QueryImpl = (sql: string, params: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;
function makePool(impl: QueryImpl) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return impl(sql, params);
  });
  return { pool: { query } as never, calls };
}

describe('normalizeStatus', () => {
  it('keeps valid statuses, falls back to draft otherwise', () => {
    expect(normalizeStatus('client_review')).toBe('client_review');
    expect(normalizeStatus('delivered')).toBe('delivered');
    expect(normalizeStatus('bogus')).toBe('draft');
    expect(normalizeStatus(undefined)).toBe('draft');
  });
});

describe('createDeliverable', () => {
  it('returns null without a title', async () => {
    const { pool, calls } = makePool(async () => ({ rows: [] }));
    const out = await createDeliverable(pool, { projectId: 'p1', title: '   ' });
    expect(out).toBeNull();
    expect(calls.length).toBe(0);
  });

  it('inserts with default status draft and no delivered_at', async () => {
    const { pool, calls } = makePool(async () => ({
      rows: [{ id: 'd1', project_id: 'p1', title: 'Hovedfilm 30s', status: 'draft', version: 1, delivered_at: null, created_at: new Date(), updated_at: new Date() }],
    }));
    const out = await createDeliverable(pool, { projectId: 'p1', title: 'Hovedfilm 30s', format: 'MP4 30s' });
    expect(out?.status).toBe('draft');
    expect(out?.deliveredAt).toBeNull();
    const insert = calls.find((c) => c.sql.includes('INSERT INTO role_room_deliverables'));
    expect(insert).toBeDefined();
    // status-param = draft, delivered_at-param = null
    expect(insert!.params).toContain('draft');
  });

  it('sets delivered_at when created directly as delivered', async () => {
    const { pool, calls } = makePool(async () => ({
      rows: [{ id: 'd1', project_id: 'p1', title: 'x', status: 'delivered', version: 1, delivered_at: new Date(), created_at: new Date(), updated_at: new Date() }],
    }));
    await createDeliverable(pool, { projectId: 'p1', title: 'x', status: 'delivered' });
    const insert = calls.find((c) => c.sql.includes('INSERT INTO role_room_deliverables'))!;
    // delivered_at-param (indeks 12) skal være en ISO-streng, ikke null
    const deliveredParam = insert.params[12];
    expect(typeof deliveredParam).toBe('string');
    expect(deliveredParam as string).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('updateDeliverable', () => {
  it('sets delivered_at when moving to delivered, clears it when moving back', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    const { pool } = makePool(async (sql, params) => {
      captured.push({ sql, params });
      return { rows: [{ id: 'd1', project_id: 'p1', title: 'x', status: 'delivered', version: 1, delivered_at: new Date(), created_at: new Date(), updated_at: new Date() }] };
    });
    await updateDeliverable(pool, 'd1', 'p1', { status: 'delivered' });
    const upd = captured.find((c) => c.sql.startsWith('UPDATE role_room_deliverables'))!;
    expect(upd.sql).toContain('delivered_at');
    // siste status-relaterte param-par: status='delivered', delivered_at=ISO
    expect(upd.params).toContain('delivered');
    expect(upd.params.some((p) => typeof p === 'string' && /\d{4}-\d{2}-\d{2}T/.test(p))).toBe(true);

    captured.length = 0;
    await updateDeliverable(pool, 'd1', 'p1', { status: 'draft' });
    const upd2 = captured.find((c) => c.sql.startsWith('UPDATE role_room_deliverables'))!;
    // delivered_at settes til null ved tilbakeflytting
    expect(upd2.params).toContain(null);
  });

  it('bumps version with bumpVersion', async () => {
    const captured: { sql: string }[] = [];
    const { pool } = makePool(async (sql) => {
      captured.push({ sql });
      return { rows: [{ id: 'd1', project_id: 'p1', title: 'x', status: 'draft', version: 2, created_at: new Date(), updated_at: new Date() }] };
    });
    await updateDeliverable(pool, 'd1', 'p1', { bumpVersion: true });
    const upd = captured.find((c) => c.sql.startsWith('UPDATE role_room_deliverables'))!;
    expect(upd.sql).toContain('version = version + 1');
  });

  it('returns existing row unchanged on empty patch (SELECT, no UPDATE)', async () => {
    const captured: { sql: string }[] = [];
    const { pool } = makePool(async (sql) => {
      captured.push({ sql });
      return { rows: [{ id: 'd1', project_id: 'p1', title: 'x', status: 'draft', version: 1, created_at: new Date(), updated_at: new Date() }] };
    });
    const out = await updateDeliverable(pool, 'd1', 'p1', {});
    expect(out?.id).toBe('d1');
    expect(captured.some((c) => c.sql.startsWith('UPDATE'))).toBe(false);
    expect(captured.some((c) => c.sql.startsWith('SELECT'))).toBe(true);
  });
});
