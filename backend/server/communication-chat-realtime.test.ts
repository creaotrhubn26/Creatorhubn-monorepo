/**
 * communication-chat-realtime.test.ts — leveringsreglene for prosjektchatten.
 *
 * Chatten skal ikke lenger polle. Det som erstatter pollen er `chat.message` på
 * bruker-event-strømmen, og da må tre ting holde på serversiden:
 *   1. hver send kringkaster til teamet — fra BEGGE send-rutene, ikke bare den
 *      ene panelet tilfeldigvis bruker,
 *   2. avsenderen får aldri sin egen hendelse (ellers henter panelet på nytt
 *      for en melding det allerede viser),
 *   3. en uten prosjekttilgang får verken melding eller hendelse.
 *
 * I tillegg pinnes tie-breakeren i lesingen: uten sekundærsortering på `id`
 * kan to meldinger med samme tidsstempel komme i ulik rekkefølge hos to lesere.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const broadcastUserEvent = vi.fn();
vi.mock('./realtime-user-events.js', () => ({
  broadcastUserEvent: (...args: unknown[]) => broadcastUserEvent(...args),
  __esModule: true,
}));
vi.mock('./project-notifications.js', () => ({
  notify: vi.fn().mockResolvedValue(null),
}));

import * as schema from '../migrations/schema.js';
import { createCommunicationRouter } from './communication-routes.js';

const PROJECT = 'P1';
const CHANNEL = `project-${PROJECT}`;
const OWNER = { userId: 'user-owner', email: 'owner@example.com', token: 'tok-owner' };
const MEMBER = { userId: 'user-member', email: 'member@example.com', token: 'tok-member' };
const OUTSIDER = { userId: 'user-outsider', email: 'outsider@example.com', token: 'tok-outsider' };

const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

function createFakePool() {
  return {
    query: async (sql: string, params: any[] = []) => {
      const q = norm(sql);
      // ── resolveProjectAccess: er DU inne? (spør alltid med $2 = brukeren) ──
      if (q.includes('FROM projects p JOIN users u') && q.includes('p.user_id::text = $2')) {
        return { rows: params[1] === OWNER.userId ? [{ display_name: 'Ola Eier' }] : [], rowCount: 0 };
      }
      if (q.includes('FROM legacy.projects p JOIN users u') && q.includes('p.user_id = $2')) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes('FROM project_team_members m LEFT JOIN users u')) {
        return { rows: params[1] === MEMBER.userId ? [{ display_name: 'Kari Medlem' }] : [], rowCount: 0 };
      }
      // ── projectTeamRecipients: hvem ER teamet? (spør kun med $1 = prosjektet) ──
      if (q.includes('FROM projects p JOIN users u') && q.includes('WHERE p.id::text = $1')) {
        return { rows: [{ uid: OWNER.userId, n: 'Ola Eier' }], rowCount: 1 };
      }
      if (q.includes('FROM legacy.projects p JOIN users u')) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes("FROM project_team_members m WHERE m.project_id = $1 AND m.status = 'active'")) {
        return { rows: [{ uid: MEMBER.userId, n: 'Kari Medlem' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as any;
}

/** Akkurat de drizzle-kallene chat-skrivingen og -lesingen gjør. */
function createFakeDb(recorded: { orderBy: any[][] }) {
  const channels: any[] = [{ id: CHANNEL }];
  const messages: any[] = [];
  const rowsFor = (table: any) => (table === schema.communicationChannels ? channels : messages);
  return {
    inserted: messages,
    db: {
      select: () => {
        let table: any = schema.communicationMessages;
        const q: any = {
          from: (t: any) => { table = t; return q; },
          where: () => q,
          orderBy: (...args: any[]) => { recorded.orderBy.push(args); return q; },
          limit: () => rowsFor(table),
          then: (res: any, rej: any) => Promise.resolve(rowsFor(table)).then(res, rej),
        };
        return q;
      },
      insert: (table: any) => ({ values: async (value: any) => { rowsFor(table).push(value); } }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    } as any,
  };
}

function createApp() {
  const recorded = { orderBy: [] as any[][] };
  const { db, inserted } = createFakeDb(recorded);
  const sessions = new Map<string, any>([
    [OWNER.token, { userId: OWNER.userId, email: OWNER.email }],
    [MEMBER.token, { userId: MEMBER.userId, email: MEMBER.email }],
    [OUTSIDER.token, { userId: OUTSIDER.userId, email: OUTSIDER.email }],
  ]);
  const app = express();
  app.use(express.json());
  app.use(createCommunicationRouter(db, createFakePool(), sessions));
  return { app, recorded, inserted };
}

const chatMessageTargets = () =>
  broadcastUserEvent.mock.calls
    .filter(([, event]: any[]) => event?.kind === 'chat.message')
    .map(([userId]: any[]) => userId);

// `notifyChatUpdated` er bevisst ikke ventet på av handleren (void), så gi
// mikrotaskene som gjør oppslagene og kringkastingen en sjanse til å kjøre.
const settle = async () => { for (let i = 0; i < 25; i += 1) await Promise.resolve(); };

describe('prosjektchat — sanntidslevering', () => {
  beforeEach(() => { broadcastUserEvent.mockClear(); });

  it('kringkaster meldingen til de andre i teamet, ikke til avsenderen', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${OWNER.token}`)
      .send({ conversationId: CHANNEL, content: 'Klar til opptak i morgen' });
    await settle();

    expect(response.status).toBe(200);
    expect(chatMessageTargets()).toEqual([MEMBER.userId]);
  });

  it('kringkaster også fra /api/communication/messages — ikke bare fra /api/chat/messages', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/api/communication/messages')
      .set('Authorization', `Bearer ${MEMBER.token}`)
      .send({ conversationId: CHANNEL, content: 'Sendt fra den andre ruta' });
    await settle();

    expect(response.status).toBe(200);
    expect(chatMessageTargets()).toEqual([OWNER.userId]);
  });

  it('nekter en uten prosjekttilgang å skrive, og kringkaster ingenting', async () => {
    const { app, inserted } = createApp();

    const response = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${OUTSIDER.token}`)
      .send({ conversationId: CHANNEL, content: 'Slipp meg inn' });
    await settle();

    expect(response.status).toBe(403);
    expect(inserted).toHaveLength(0);
    expect(broadcastUserEvent).not.toHaveBeenCalled();
  });

  it('nekter en uten prosjekttilgang å lese kanalen', async () => {
    const { app } = createApp();

    const response = await request(app)
      .get(`/api/communication/messages/${CHANNEL}`)
      .set('Authorization', `Bearer ${OUTSIDER.token}`);

    expect(response.status).toBe(403);
  });

  it('sorterer meldinger med id som tie-breaker, så rekkefølgen er lik for alle', async () => {
    const { app, recorded } = createApp();

    const response = await request(app)
      .get(`/api/communication/messages/${CHANNEL}`)
      .set('Authorization', `Bearer ${OWNER.token}`);

    expect(response.status).toBe(200);
    // To sorteringsledd: created_at og deretter id. Faller det andre bort, kan
    // to meldinger på samme tidsstempel vises i ulik rekkefølge hos to lesere.
    expect(recorded.orderBy).toHaveLength(1);
    expect(recorded.orderBy[0]).toHaveLength(2);
  });
});
