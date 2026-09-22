import type { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const email = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('./role-room-partnerships-emails.js', () => ({
  sendTalentRequestAgencyNotification: email.send,
}));

import {
  enqueueTalentRequestCancellation,
  runTalentRequestNotificationSweep,
} from './role-room-talent-request-notifications.js';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const DELIVERY_ID = '22222222-2222-4222-8222-222222222222';

describe('talent request notification sweep', () => {
  beforeEach(() => {
    email.send.mockReset();
    email.send.mockResolvedValue({ sent: true, reason: null });
  });

  it('claims a due notice with SKIP LOCKED and marks it sent', async () => {
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      if (text.includes("SET status = 'expired'")) return { rows: [], rowCount: 0 };
      if (text.includes('INSERT INTO partnership_talent_request_deliveries') && params?.[0] === 'deadline_24h') {
        return { rows: [{ id: DELIVERY_ID }], rowCount: 1 };
      }
      if (text.includes('INSERT INTO partnership_talent_request_deliveries')) return { rows: [], rowCount: 0 };
      if (text.includes('FROM partnership_talent_requests r') && text.includes("d.notification_kind = 'cancelled'")) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FOR UPDATE SKIP LOCKED')) {
        return {
          rows: [{
            id: DELIVERY_ID,
            talent_request_id: REQUEST_ID,
            notification_kind: 'deadline_24h',
            attempts: 1,
          }],
          rowCount: 1,
        };
      }
      if (text.includes('$2::text AS notification_kind')) {
        return {
          rows: [{
            request_id: REQUEST_ID,
            notification_kind: 'deadline_24h',
            requested_by_user_id: 'casting-user',
            response_deadline: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
            agency_name: 'Nordic Talent',
            agency_email: 'agency@example.com',
            project_name: 'Troll',
            role_name: 'NORA',
            talent_display_name: 'Ada Skuespiller',
          }],
          rowCount: 1,
        };
      }
      if (text.includes("SET status = 'sent'")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    const result = await runTalentRequestNotificationSweep({ query } as unknown as Pool);

    expect(result).toMatchObject({ enqueued24h: 1, claimed: 1, sent: 1, failed: 0 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('FOR UPDATE SKIP LOCKED'))).toBe(true);
    expect(email.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        notificationKind: 'deadline_24h',
        requestId: REQUEST_ID,
        recipientEmail: 'agency@example.com',
      }),
    );
  });

  it('previews deadlines without mutating delivery state', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ due_48h: 2, due_24h: 1, overdue: 3 }],
      rowCount: 1,
    });
    const result = await runTalentRequestNotificationSweep(
      { query } as unknown as Pool,
      { dryRun: true },
    );

    expect(result).toMatchObject({
      enqueued48h: 2,
      enqueued24h: 1,
      enqueuedOverdue: 3,
      claimed: 0,
      dryRun: true,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain('SELECT');
  });

  it('enqueues a cancellation idempotently through the unique ledger', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: DELIVERY_ID }], rowCount: 1 });
    const inserted = await enqueueTalentRequestCancellation(
      { query } as unknown as Pool,
      REQUEST_ID,
    );

    expect(inserted).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (talent_request_id, notification_kind) DO NOTHING'),
      [REQUEST_ID],
    );
  });
});
