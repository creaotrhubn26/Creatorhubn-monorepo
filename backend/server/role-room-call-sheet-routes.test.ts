import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendTransactionalEmail, resolveTabAccessLevel, viewerMeetsTabLevel } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  resolveTabAccessLevel: vi.fn(),
  viewerMeetsTabLevel: vi.fn(),
}));
vi.mock('./transactional-email-service.js', () => ({ sendTransactionalEmail }));
vi.mock('./role-room-projects-routes.js', () => ({ canAccessRoleRoomProject: vi.fn().mockResolvedValue(true) }));
vi.mock('./role-room-tab-access.js', () => ({ resolveTabAccessLevel, viewerMeetsTabLevel }));
vi.mock('./ai-rate-limiter.js', () => ({ aiRateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next() }));

import { setupRoleRoomCallSheetRoutes } from './role-room-call-sheet-routes.js';

function createApp(query: ReturnType<typeof vi.fn>, userId = 'second-ad-1') {
  const app = express();
  app.use(express.json());
  setupRoleRoomCallSheetRoutes({
    app,
    pool: { query } as unknown as Pool,
    requireUserSession: () => ({ userId }),
  });
  return app;
}

describe('role-room call sheet receipts', () => {
  beforeEach(() => {
    sendTransactionalEmail.mockReset().mockResolvedValue({ sent: true, reason: null, messageId: 'message-1' });
    resolveTabAccessLevel.mockReset().mockResolvedValue('manage');
    viewerMeetsTabLevel.mockReset().mockResolvedValue(true);
  });

  it('persists a hashed receipt token and escapes the recipient name', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO role_room_call_sheet_deliveries')) return { rows: [{ id: 'delivery-1' }] };
      if (sql.includes('INSERT INTO role_room_call_sheet_recipients')) return { rows: [{ id: 'recipient-1' }] };
      if (sql.includes('UPDATE role_room_call_sheet_recipients')) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(createApp(query)).post('/api/role-room/call-sheets/send').send({
      projectId: 'project-1', productionDayId: 'day-1', revision: 2, subject: 'Dag 1', html: '<p>Plan</p>',
      recipients: [{ name: '<img src=x onerror=alert(1)>', email: 'cast@example.test' }],
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ deliveryId: 'delivery-1', sent: 1, total: 1, acknowledged: 0 });
    const recipientInsert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO role_room_call_sheet_recipients'));
    expect(recipientInsert?.[1]?.[3]).toMatch(/^[a-f0-9]{64}$/);
    const mail = sendTransactionalEmail.mock.calls[0][0];
    expect(mail.html).toContain('&lt;img');
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).toContain('Bekreft mottak');
  });

  it('acknowledges valid capability tokens without exposing the stored token', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('UPDATE role_room_call_sheet_recipients')) return { rows: [{ acknowledged_at: new Date().toISOString() }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const token = 'A'.repeat(43);
    const response = await request(createApp(query)).post(`/api/role-room/call-sheets/acknowledge/${token}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain('Mottak bekreftet');
    expect(query.mock.calls[0][1][0]).toMatch(/^[a-f0-9]{64}$/);
    expect(query.mock.calls[0][1][0]).not.toBe(token);
  });

  it('denies a director without an explicit manage override from sending', async () => {
    resolveTabAccessLevel.mockResolvedValue(null);
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT role FROM casting_user_roles')) return { rows: [{ role: 'director' }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(createApp(query, 'director-1')).post('/api/role-room/call-sheets/send').send({
      projectId: 'project-1', productionDayId: 'day-1', subject: 'Dag 1', html: '<p>Plan</p>',
      recipients: [{ name: 'Skuespiller', email: 'cast@example.test' }],
    });
    expect(response.status).toBe(403);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('allows the default second AD role to distribute call sheets', async () => {
    resolveTabAccessLevel.mockResolvedValue(null);
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT role FROM casting_user_roles')) return { rows: [{ role: 'second_ad' }] };
      if (sql.includes('INSERT INTO role_room_call_sheet_deliveries')) return { rows: [{ id: 'delivery-2' }] };
      if (sql.includes('INSERT INTO role_room_call_sheet_recipients')) return { rows: [{ id: 'recipient-2' }] };
      if (sql.includes('UPDATE role_room_call_sheet_recipients')) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(createApp(query)).post('/api/role-room/call-sheets/send').send({
      projectId: 'project-1', productionDayId: 'day-1', subject: 'Dag 1', html: '<p>Plan</p>',
      recipients: [{ name: 'Skuespiller', email: 'cast@example.test' }],
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ sent: 1, total: 1 });
  });

  it('lets an explicit manage override grant distribution to a director', async () => {
    resolveTabAccessLevel.mockResolvedValue('manage');
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO role_room_call_sheet_deliveries')) return { rows: [{ id: 'delivery-3' }] };
      if (sql.includes('INSERT INTO role_room_call_sheet_recipients')) return { rows: [{ id: 'recipient-3' }] };
      if (sql.includes('UPDATE role_room_call_sheet_recipients')) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(createApp(query, 'director-1')).post('/api/role-room/call-sheets/send').send({
      projectId: 'project-1', productionDayId: 'day-1', subject: 'Dag 1', html: '<p>Plan</p>',
      recipients: [{ name: 'Skuespiller', email: 'cast@example.test' }],
    });
    expect(response.status).toBe(200);
  });

  it('lets an explicit view override remove distribution from a default manager', async () => {
    resolveTabAccessLevel.mockResolvedValue('view');
    const query = vi.fn(async (sql: string) => {
      throw new Error(`No SQL expected after access rejection: ${sql}`);
    });
    const response = await request(createApp(query)).post('/api/role-room/call-sheets/send').send({
      projectId: 'project-1', productionDayId: 'day-1', subject: 'Dag 1', html: '<p>Plan</p>',
      recipients: [{ name: 'Skuespiller', email: 'cast@example.test' }],
    });
    expect(response.status).toBe(403);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
