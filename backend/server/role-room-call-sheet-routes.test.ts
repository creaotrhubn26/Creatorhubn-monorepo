import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendTransactionalEmail } = vi.hoisted(() => ({ sendTransactionalEmail: vi.fn() }));
vi.mock('./transactional-email-service.js', () => ({ sendTransactionalEmail }));
vi.mock('./role-room-projects-routes.js', () => ({ canAccessRoleRoomProject: vi.fn().mockResolvedValue(true) }));
vi.mock('./role-room-tab-access.js', () => ({ viewerMeetsTabLevel: vi.fn().mockResolvedValue(true) }));

import { setupRoleRoomCallSheetRoutes } from './role-room-call-sheet-routes.js';

function createApp(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  setupRoleRoomCallSheetRoutes({
    app,
    pool: { query } as unknown as Pool,
    requireUserSession: () => ({ userId: 'second-ad-1' }),
  });
  return app;
}

describe('role-room call sheet receipts', () => {
  beforeEach(() => {
    sendTransactionalEmail.mockReset().mockResolvedValue({ sent: true, reason: null, messageId: 'message-1' });
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
});
