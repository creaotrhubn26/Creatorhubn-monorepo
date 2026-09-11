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
      if (sql.includes('INSERT INTO role_room_call_sheet_deliveries')) return { rows: [{ id: 'delivery-1', revision: 2 }] };
      if (sql.includes('INSERT INTO role_room_call_sheet_recipients')) return { rows: [{ id: 'recipient-1' }] };
      if (sql.includes('UPDATE role_room_call_sheet_recipients')) return { rows: [] };
      if (sql.includes("'delivery_completed'")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(createApp(query)).post('/api/role-room/call-sheets/send').send({
      projectId: 'project-1', productionDayId: 'day-1', revision: 99, subject: 'Dag 1\r\nBcc: attacker@example.test', html: '<p>Plan</p>',
      snapshot: { schemaVersion: 1, general: { callTime: '07:00' } },
      recipients: [{ name: '<img src=x onerror=alert(1)>', email: 'cast@example.test' }],
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ deliveryId: 'delivery-1', revision: 2, sent: 1, total: 1, acknowledged: 0 });
    const deliveryInsert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO role_room_call_sheet_deliveries'));
    expect(deliveryInsert?.[1]?.[4]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(deliveryInsert?.[1]?.[5])).toMatchObject({ schemaVersion: 1 });
    expect(deliveryInsert?.[1]?.[2]).toBe('Dag 1 Bcc: attacker@example.test');
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
    expect(String(query.mock.calls[0][0])).toContain("d.status='published'");
    expect(query.mock.calls[0][1][0]).toMatch(/^[a-f0-9]{64}$/);
    expect(query.mock.calls[0][1][0]).not.toBe(token);
  });

  it('returns recipient-level sent, failed and acknowledged delivery status', async () => {
    const deliveryId = '11111111-1111-4111-8111-111111111111';
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('COUNT(r.id)')) return { rows: [{
        id: deliveryId,
        production_day_id: 'day-1',
        revision: 3,
        subject: 'Troll · dag 1',
        status: 'published',
        supersedes_delivery_id: '55555555-5555-4555-8555-555555555555',
        content_hash: 'a'.repeat(64),
        snapshot: { schemaVersion: 1, general: { callTime: '07:00' } },
        retracted_at: null,
        created_at: '2026-09-11T08:00:00.000Z',
        total: 2,
        sent: 1,
        failed: 1,
        acknowledged: 1,
      }] };
      if (sql.includes('FROM role_room_call_sheet_recipients WHERE delivery_id=ANY')) return { rows: [{
        id: '22222222-2222-4222-8222-222222222222',
        delivery_id: deliveryId,
        recipient_name: 'Ada',
        recipient_email: 'ada@example.test',
        delivery_status: 'sent',
        failure_reason: null,
        sent_at: '2026-09-11T08:00:01.000Z',
        acknowledged_at: '2026-09-11T08:05:00.000Z',
        reminder_count: 1,
        last_reminded_at: '2026-09-11T08:04:00.000Z',
      }] };
      if (sql.includes('FROM role_room_call_sheet_events WHERE delivery_id=ANY')) return { rows: [{
        id: '33333333-3333-4333-8333-333333333333',
        delivery_id: deliveryId,
        event_type: 'acknowledged',
        actor_user_id: null,
        recipient_id: '22222222-2222-4222-8222-222222222222',
        details: {},
        created_at: '2026-09-11T08:05:00.000Z',
      }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(createApp(query)).get('/api/role-room/projects/project-1/call-sheet-deliveries?productionDayId=day-1');

    expect(response.status).toBe(200);
    expect(response.body.deliveries[0]).toMatchObject({
      revision: 3,
      status: 'published',
      supersedesDeliveryId: '55555555-5555-4555-8555-555555555555',
      snapshot: { schemaVersion: 1, general: { callTime: '07:00' } },
      total: 2,
      sent: 1,
      failed: 1,
      acknowledged: 1,
    });
    expect(response.body.deliveries[0].recipients[0]).toMatchObject({
      name: 'Ada',
      deliveryStatus: 'sent',
      reminderCount: 1,
    });
    expect(response.body.deliveries[0].events[0]).toMatchObject({ type: 'acknowledged' });
  });

  it('reminds only unacknowledged sent recipients with a new hashed capability', async () => {
    const deliveryId = '11111111-1111-4111-8111-111111111111';
    const recipientId = '22222222-2222-4222-8222-222222222222';
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id,project_id,production_day_id,subject,status')) return { rows: [{ id: deliveryId, project_id: 'project-1', production_day_id: 'day-1', subject: 'Troll · dag 1', status: 'published' }] };
      if (sql.includes("delivery_status='sent' AND acknowledged_at IS NULL")) return { rows: [{ id: recipientId, recipient_name: '<Ada>', recipient_email: 'ada@example.test' }] };
      if (sql.includes('INSERT INTO role_room_call_sheet_recipient_tokens')) return { rows: [{ id: '33333333-3333-4333-8333-333333333333' }] };
      if (sql.includes('SET reminder_count=reminder_count+1')) return { rows: [] };
      if (sql.includes("'reminded'")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(createApp(query)).post(`/api/role-room/call-sheet-deliveries/${deliveryId}/remind`).send({ recipientIds: [recipientId] });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ deliveryId, reminded: 1, total: 1 });
    const tokenInsert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO role_room_call_sheet_recipient_tokens'));
    expect(tokenInsert?.[1]?.[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ada@example.test',
      subject: 'Påminnelse · Troll · dag 1',
    }));
    const mail = sendTransactionalEmail.mock.calls[0][0];
    expect(mail.html).toContain('&lt;Ada&gt;');
    expect(mail.html).not.toContain('<Ada>');
    expect(mail.text).toContain('/api/role-room/call-sheets/acknowledge/');
  });

  it('does not let a viewer use a delivery id to send reminders', async () => {
    resolveTabAccessLevel.mockResolvedValue('view');
    const deliveryId = '11111111-1111-4111-8111-111111111111';
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id,project_id,production_day_id,subject,status')) return { rows: [{ id: deliveryId, project_id: 'project-1', production_day_id: 'day-1', subject: 'Troll · dag 1', status: 'published' }] };
      throw new Error(`No recipient lookup expected after access rejection: ${sql}`);
    });

    const response = await request(createApp(query)).post(`/api/role-room/call-sheet-deliveries/${deliveryId}/remind`).send({});

    expect(response.status).toBe(403);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
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
      if (sql.includes('INSERT INTO role_room_call_sheet_deliveries')) return { rows: [{ id: 'delivery-2', revision: 1 }] };
      if (sql.includes('INSERT INTO role_room_call_sheet_recipients')) return { rows: [{ id: 'recipient-2' }] };
      if (sql.includes('UPDATE role_room_call_sheet_recipients')) return { rows: [] };
      if (sql.includes("'delivery_completed'")) return { rows: [] };
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
      if (sql.includes('INSERT INTO role_room_call_sheet_deliveries')) return { rows: [{ id: 'delivery-3', revision: 1 }] };
      if (sql.includes('INSERT INTO role_room_call_sheet_recipients')) return { rows: [{ id: 'recipient-3' }] };
      if (sql.includes('UPDATE role_room_call_sheet_recipients')) return { rows: [] };
      if (sql.includes("'delivery_completed'")) return { rows: [] };
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

  it('rejects a stale replacement before sending external email', async () => {
    const supersedesDeliveryId = '11111111-1111-4111-8111-111111111111';
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO role_room_call_sheet_deliveries')) return { rows: [] };
      throw new Error(`No email persistence expected for a stale revision: ${sql}`);
    });

    const response = await request(createApp(query)).post('/api/role-room/call-sheets/send').send({
      projectId: 'project-1', productionDayId: 'day-1', supersedesDeliveryId,
      subject: 'Dag 1', html: '<p>Ny plan</p>', snapshot: { schemaVersion: 1 },
      recipients: [{ name: 'Ada', email: 'ada@example.test' }],
    });

    expect(response.status).toBe(409);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(query.mock.calls[0][1][6]).toBe(supersedesDeliveryId);
  });

  it('retracts only the active revision and invalidates its capabilities', async () => {
    const deliveryId = '11111111-1111-4111-8111-111111111111';
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id,project_id,production_day_id,status')) return { rows: [{ id: deliveryId, project_id: 'project-1', production_day_id: 'day-1', status: 'published' }] };
      if (sql.includes("SET status='retracted'")) return { rows: [{ id: deliveryId }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(createApp(query)).post(`/api/role-room/call-sheet-deliveries/${deliveryId}/retract`).send({ reason: 'Feil calltid' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ deliveryId, status: 'retracted', alreadyRetracted: false });
    const retraction = query.mock.calls.find(([sql]) => String(sql).includes("SET status='retracted'"));
    expect(retraction?.[1]).toEqual([deliveryId, 'second-ad-1', 'Feil calltid']);
    expect(String(retraction?.[0])).toContain('SET expires_at=NOW()');
  });

  it('does not let a viewer retract a delivery by guessing its id', async () => {
    resolveTabAccessLevel.mockResolvedValue('view');
    const deliveryId = '11111111-1111-4111-8111-111111111111';
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id,project_id,production_day_id,status')) return { rows: [{ id: deliveryId, project_id: 'project-1', production_day_id: 'day-1', status: 'published' }] };
      throw new Error(`No mutation expected after access rejection: ${sql}`);
    });

    const response = await request(createApp(query)).post(`/api/role-room/call-sheet-deliveries/${deliveryId}/retract`).send({});

    expect(response.status).toBe(403);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
