/**
 * communication-chat-threads.test.ts — tråder i prosjektchatten.
 *
 * Reglene som må holde:
 *   - et svar knyttes til én ROTmelding i SAMME kanal (ellers kan en gjettet
 *     meldings-id henge et svar inn i en kanal du ikke slipper inn i),
 *   - et svar kan ikke selv bli forelder — tråden er flat, som
 *     `audio_review_comments` i prod,
 *   - hovedlista viser rotmeldinger med svartelling, ikke svarene selv,
 *   - tråd-endepunktet er gated som kanalen sin.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./realtime-user-events.js', () => ({
  broadcastUserEvent: vi.fn(),
  __esModule: true,
}));
vi.mock('./project-notifications.js', () => ({
  notify: vi.fn().mockResolvedValue(null),
}));

import * as schema from '../migrations/schema.js';
import { createCommunicationRouter } from './communication-routes.js';

const PROJECT = 'P1';
const CHANNEL = `project-${PROJECT}`;
const OTHER_CHANNEL = 'project-P2';
const OWNER = { userId: 'user-owner', email: 'owner@example.com', token: 'tok-owner' };
const OUTSIDER = { userId: 'user-outsider', email: 'outsider@example.com', token: 'tok-outsider' };

interface Row {
  id: string;
  channel_id: string;
  sender_id: string;
  message_type: string;
  content: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  delivered_at: Date | null;
  parent_message_id: string | null;
  created_at: Date;
}

const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

function createHarness() {
  const messages: Row[] = [];
  let clock = 0;
  const seed = (row: Partial<Row> & { id: string }): Row => {
    clock += 1;
    const full: Row = {
      channel_id: CHANNEL,
      sender_id: OWNER.email,
      message_type: 'text',
      content: 'melding',
      metadata: {},
      is_read: false,
      delivered_at: null,
      parent_message_id: null,
      created_at: new Date(1_700_000_000_000 + clock * 1000),
      ...row,
    } as Row;
    messages.push(full);
    return full;
  };

  const pool = {
    query: async (sql: string, params: any[] = []) => {
      const q = norm(sql);
      // ── tilgang ──
      if (q.includes('FROM projects p JOIN users u') && q.includes('p.user_id::text = $2')) {
        return { rows: params[1] === OWNER.userId ? [{ display_name: 'Ola Eier' }] : [], rowCount: 0 };
      }
      if (q.includes('FROM legacy.projects p JOIN users u') && q.includes('p.user_id = $2')) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes('FROM project_team_members m LEFT JOIN users u')) {
        return { rows: [], rowCount: 0 };
      }
      // ── mottakere ──
      if (q.includes('FROM projects p JOIN users u') && q.includes('WHERE p.id::text = $1')) {
        return { rows: [{ uid: OWNER.userId, n: 'Ola Eier' }], rowCount: 1 };
      }
      if (q.includes('FROM legacy.projects p JOIN users u')) return { rows: [], rowCount: 0 };
      if (q.includes("FROM project_team_members m WHERE m.project_id = $1 AND m.status = 'active'")) {
        return { rows: [], rowCount: 0 };
      }
      // ── tråder ──
      if (q.startsWith('SELECT id FROM communication_messages WHERE id = $1 AND channel_id = $2 AND parent_message_id IS NULL')) {
        const hit = messages.find((m) => m.id === params[0] && m.channel_id === params[1] && m.parent_message_id === null);
        return { rows: hit ? [{ id: hit.id }] : [], rowCount: hit ? 1 : 0 };
      }
      if (q.includes('COUNT(*)::int AS reply_count')) {
        const [channelId, rootIds] = params as [string, string[]];
        const grouped = new Map<string, Row[]>();
        for (const m of messages) {
          if (m.channel_id !== channelId || !m.parent_message_id) continue;
          if (!rootIds.includes(m.parent_message_id)) continue;
          grouped.set(m.parent_message_id, [...(grouped.get(m.parent_message_id) ?? []), m]);
        }
        return {
          rows: [...grouped.entries()].map(([pid, rows]) => ({
            pid,
            reply_count: rows.length,
            last_reply_at: rows.map((r) => r.created_at).sort((a, b) => b.getTime() - a.getTime())[0],
          })),
          rowCount: grouped.size,
        };
      }
      if (q.includes('WHERE channel_id = $1 AND (id = $2 OR parent_message_id = $2)')) {
        const [channelId, parentId] = params as [string, string];
        const rows = messages
          .filter((m) => m.channel_id === channelId && (m.id === parentId || m.parent_message_id === parentId))
          .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id));
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    },
  } as any;

  const toCamel = (row: Row) => ({
    id: row.id,
    channelId: row.channel_id,
    senderId: row.sender_id,
    messageType: row.message_type,
    content: row.content,
    metadata: row.metadata,
    isRead: row.is_read,
    deliveredAt: row.delivered_at,
    parentMessageId: row.parent_message_id,
    createdAt: row.created_at,
  });

  const db = {
    select: () => {
      let table: any = schema.communicationMessages;
      const rows = () => (table === schema.communicationChannels
        ? [{ id: CHANNEL }]
        // Speiler ruten: kun rotmeldinger i kanalen, nyeste først.
        : messages
          .filter((m) => m.channel_id === CHANNEL && m.parent_message_id === null)
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
          .map(toCamel));
      const q: any = {
        from: (t: any) => { table = t; return q; },
        where: () => q,
        orderBy: () => q,
        limit: () => rows(),
        then: (res: any, rej: any) => Promise.resolve(rows()).then(res, rej),
      };
      return q;
    },
    insert: (table: any) => ({
      values: async (value: any) => {
        if (table !== schema.communicationMessages) return;
        seed({
          id: String(value.id),
          channel_id: String(value.channelId),
          sender_id: String(value.senderId),
          message_type: String(value.messageType),
          content: String(value.content ?? ''),
          metadata: (value.metadata ?? {}) as Record<string, unknown>,
          parent_message_id: value.parentMessageId ?? null,
        });
      },
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  } as any;

  const sessions = new Map<string, any>([
    [OWNER.token, { userId: OWNER.userId, email: OWNER.email }],
    [OUTSIDER.token, { userId: OUTSIDER.userId, email: OUTSIDER.email }],
  ]);
  const app = express();
  app.use(express.json());
  app.use(createCommunicationRouter(db, pool, sessions));
  return { app, messages, seed };
}

const settle = async () => { for (let i = 0; i < 25; i += 1) await Promise.resolve(); };

describe('prosjektchat — tråder', () => {
  let harness: ReturnType<typeof createHarness>;
  beforeEach(() => { harness = createHarness(); });

  it('knytter et svar til riktig rotmelding', async () => {
    const root = harness.seed({ id: 'root-1', content: 'Hvem tar kamera 2?' });

    const response = await request(harness.app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${OWNER.token}`)
      .send({ conversationId: CHANNEL, content: 'Jeg tar den', parentMessageId: root.id });
    await settle();

    expect(response.status).toBe(200);
    expect(response.body.parentMessageId).toBe('root-1');
    const stored = harness.messages.find((m) => m.id === response.body.id);
    expect(stored?.parent_message_id).toBe('root-1');
  });

  it('teller svarene på hovedlista, og viser ikke svarene som egne meldinger', async () => {
    harness.seed({ id: 'root-1' });
    harness.seed({ id: 'root-2' });
    harness.seed({ id: 'reply-a', parent_message_id: 'root-1' });
    harness.seed({ id: 'reply-b', parent_message_id: 'root-1' });

    const response = await request(harness.app)
      .get(`/api/communication/messages/${CHANNEL}`)
      .set('Authorization', `Bearer ${OWNER.token}`);

    expect(response.status).toBe(200);
    expect(response.body.messages.map((m: any) => m.id)).toEqual(['root-1', 'root-2']);
    const byId = Object.fromEntries(response.body.messages.map((m: any) => [m.id, m]));
    expect(byId['root-1'].replyCount).toBe(2);
    expect(byId['root-1'].lastReplyAt).toBeTruthy();
    expect(byId['root-2'].replyCount).toBe(0);
  });

  it('åpner tråden med forelder og svar i rekkefølge', async () => {
    harness.seed({ id: 'root-1', content: 'Hvem tar kamera 2?' });
    harness.seed({ id: 'reply-a', parent_message_id: 'root-1', content: 'Jeg' });
    harness.seed({ id: 'reply-b', parent_message_id: 'root-1', content: 'Da er vi to' });
    harness.seed({ id: 'root-2', content: 'Urelatert' });

    const response = await request(harness.app)
      .get(`/api/communication/messages/${CHANNEL}/thread/root-1`)
      .set('Authorization', `Bearer ${OWNER.token}`);

    expect(response.status).toBe(200);
    expect(response.body.parent.id).toBe('root-1');
    expect(response.body.replies.map((m: any) => m.id)).toEqual(['reply-a', 'reply-b']);
    expect(response.body.replyCount).toBe(2);
  });

  it('avviser et svar på en melding i en annen kanal', async () => {
    harness.seed({ id: 'other-root', channel_id: OTHER_CHANNEL });
    const before = harness.messages.length;

    const response = await request(harness.app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${OWNER.token}`)
      .send({ conversationId: CHANNEL, content: 'Snik', parentMessageId: 'other-root' });
    await settle();

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_parent');
    expect(harness.messages).toHaveLength(before);
  });

  it('avviser svar på et svar — tråden er flat', async () => {
    harness.seed({ id: 'root-1' });
    harness.seed({ id: 'reply-a', parent_message_id: 'root-1' });

    const response = await request(harness.app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${OWNER.token}`)
      .send({ conversationId: CHANNEL, content: 'Undertråd', parentMessageId: 'reply-a' });
    await settle();

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_parent');
  });

  it('gir 404 for en tråd som ikke finnes, og for et svar brukt som forelder', async () => {
    harness.seed({ id: 'root-1' });
    harness.seed({ id: 'reply-a', parent_message_id: 'root-1' });

    const missing = await request(harness.app)
      .get(`/api/communication/messages/${CHANNEL}/thread/nope`)
      .set('Authorization', `Bearer ${OWNER.token}`);
    const nested = await request(harness.app)
      .get(`/api/communication/messages/${CHANNEL}/thread/reply-a`)
      .set('Authorization', `Bearer ${OWNER.token}`);

    expect(missing.status).toBe(404);
    expect(nested.status).toBe(404);
  });

  it('nekter en uten prosjekttilgang å lese en tråd', async () => {
    harness.seed({ id: 'root-1' });

    const response = await request(harness.app)
      .get(`/api/communication/messages/${CHANNEL}/thread/root-1`)
      .set('Authorization', `Bearer ${OUTSIDER.token}`);

    expect(response.status).toBe(403);
  });
});
