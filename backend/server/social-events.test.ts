import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flattenIgWebhookEvent,
  flattenFacebookPageWebhookEvent,
  persistSocialEvent,
  listPendingSentimentEvents,
  setEventSentiment,
} from './social-events.js';

// ── flattenIgWebhookEvent ───────────────────────────────────────────────

describe('flattenIgWebhookEvent', () => {
  it('flattens a comment event with author + post link', () => {
    const events = flattenIgWebhookEvent({
      object: 'instagram',
      entry: [
        {
          id: 'ig-acct-1',
          time: 1714521600,
          changes: [
            {
              field: 'comments',
              value: {
                id: 'comment-1',
                text: 'Looks great!',
                from: { id: 'user-9', username: 'fan_9' },
                media: { id: 'media-77' },
              },
            },
          ],
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      platform: 'instagram',
      accountId: 'ig-acct-1',
      kind: 'comment',
      externalEventId: 'comment-1',
      externalPostId: 'media-77',
      authorExternalId: 'user-9',
      authorUsername: 'fan_9',
      body: 'Looks great!',
    });
    expect(events[0].occurredAt?.toISOString()).toBe('2024-04-30T22:40:00.000Z');
  });

  it('classifies replies via parent_id', () => {
    const events = flattenIgWebhookEvent({
      entry: [
        {
          id: 'ig-1',
          changes: [
            {
              field: 'comments',
              value: {
                id: 'reply-1',
                parent_id: 'comment-99',
                text: 'agree',
              },
            },
          ],
        },
      ],
    });
    expect(events[0].kind).toBe('reply');
    expect(events[0].externalThreadId).toBe('comment-99');
  });

  it('handles mentions with media_id + comment_id', () => {
    const events = flattenIgWebhookEvent({
      entry: [
        {
          id: 'ig-1',
          changes: [
            {
              field: 'mentions',
              value: { media_id: 'media-1', comment_id: 'comment-2' },
            },
          ],
        },
      ],
    });
    expect(events[0].kind).toBe('mention');
    expect(events[0].externalEventId).toBe('comment-2');
    expect(events[0].externalPostId).toBe('media-1');
  });

  it('handles DM via messages field', () => {
    const events = flattenIgWebhookEvent({
      entry: [
        {
          id: 'ig-1',
          changes: [
            {
              field: 'messages',
              value: {
                sender: { id: 'user-9' },
                message: { mid: 'msg-1', text: 'hei!' },
              },
            },
          ],
        },
      ],
    });
    expect(events[0].kind).toBe('dm');
    expect(events[0].externalEventId).toBe('msg-1');
    expect(events[0].body).toBe('hei!');
    expect(events[0].authorExternalId).toBe('user-9');
  });

  it('falls back to "other" for unknown fields', () => {
    const events = flattenIgWebhookEvent({
      entry: [{ id: 'ig-1', changes: [{ field: 'story_insights', value: { reach: 5 } }] }],
    });
    expect(events[0].kind).toBe('other');
    expect(events[0].raw).toMatchObject({ field: 'story_insights', reach: 5 });
  });

  it('skips entries without an account id', () => {
    const events = flattenIgWebhookEvent({
      entry: [{ changes: [{ field: 'comments', value: { id: 'c' } }] }],
    });
    expect(events).toHaveLength(0);
  });

  it('handles multiple changes per entry', () => {
    const events = flattenIgWebhookEvent({
      entry: [
        {
          id: 'ig-1',
          changes: [
            { field: 'comments', value: { id: 'c1', text: 'one' } },
            { field: 'mentions', value: { media_id: 'm1' } },
          ],
        },
      ],
    });
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.kind)).toEqual(['comment', 'mention']);
  });
});

// ── flattenFacebookPageWebhookEvent ─────────────────────────────────────

describe('flattenFacebookPageWebhookEvent', () => {
  it('flattens a feed comment with author and post', () => {
    const events = flattenFacebookPageWebhookEvent({
      entry: [
        {
          id: 'page-1',
          time: 1714521600,
          changes: [
            {
              field: 'feed',
              value: {
                item: 'comment',
                verb: 'add',
                comment_id: 'fb-c-1',
                post_id: 'fb-p-1',
                from: { id: 'user-1', name: 'Ola Nordmann' },
                message: 'Bra jobba!',
              },
            },
          ],
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      platform: 'facebook_page',
      accountId: 'page-1',
      kind: 'comment',
      externalEventId: 'fb-c-1',
      externalPostId: 'fb-p-1',
      authorDisplayName: 'Ola Nordmann',
      body: 'Bra jobba!',
    });
  });

  it('classifies feed replies via parent_id', () => {
    const events = flattenFacebookPageWebhookEvent({
      entry: [
        {
          id: 'page-1',
          changes: [
            {
              field: 'feed',
              value: {
                item: 'comment',
                verb: 'add',
                comment_id: 'r1',
                parent_id: 'c1',
                from: { id: 'u', name: 'X' },
                message: 'tilsvar',
              },
            },
          ],
        },
      ],
    });
    expect(events[0].kind).toBe('reply');
    expect(events[0].externalThreadId).toBe('c1');
  });

  it('handles reactions', () => {
    const events = flattenFacebookPageWebhookEvent({
      entry: [
        {
          id: 'page-1',
          changes: [
            {
              field: 'feed',
              value: {
                item: 'reaction',
                verb: 'add',
                post_id: 'p1',
                reaction_type: 'love',
                from: { id: 'u9', name: 'A' },
              },
            },
          ],
        },
      ],
    });
    expect(events[0].kind).toBe('reaction');
    expect(events[0].body).toBe('love');
    expect(events[0].externalPostId).toBe('p1');
  });

  it('handles mention field', () => {
    const events = flattenFacebookPageWebhookEvent({
      entry: [
        {
          id: 'page-1',
          changes: [
            {
              field: 'mention',
              value: {
                post_id: 'p2',
                sender_id: 'u3',
                sender_name: 'B',
                message: 'sjekk @sidenmin',
              },
            },
          ],
        },
      ],
    });
    expect(events[0]).toMatchObject({
      platform: 'facebook_page',
      kind: 'mention',
      authorDisplayName: 'B',
      body: 'sjekk @sidenmin',
      externalPostId: 'p2',
    });
  });
});

// ── persistSocialEvent ──────────────────────────────────────────────────

function makePool(impl: (sql: string, args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>) {
  return { query: vi.fn(async (sql: string, args: unknown[] = []) => impl(sql, args)) };
}

describe('persistSocialEvent', () => {
  it('returns inserted=true when INSERT yields a row', async () => {
    const pool = makePool(async (sql) => {
      expect(sql).toContain('INSERT INTO social_events');
      expect(sql).toContain('ON CONFLICT');
      return { rows: [{ id: 'evt-1' }], rowCount: 1 };
    });
    const r = await persistSocialEvent(pool as never, {
      platform: 'instagram',
      accountId: 'ig-1',
      kind: 'comment',
      externalEventId: 'c1',
      body: 'hi',
      raw: {},
    });
    expect(r).toEqual({ inserted: true, id: 'evt-1' });
  });

  it('returns inserted=false on ON CONFLICT no-op (rowCount 0)', async () => {
    const pool = makePool(async () => ({ rows: [], rowCount: 0 }));
    const r = await persistSocialEvent(pool as never, {
      platform: 'instagram',
      accountId: 'ig-1',
      kind: 'comment',
      externalEventId: 'c1',
      raw: {},
    });
    expect(r.inserted).toBe(false);
  });

  it('serialises raw object to JSON for jsonb column', async () => {
    let captured: unknown[] = [];
    const pool = makePool(async (_sql, args) => {
      captured = args;
      return { rows: [{ id: 'x' }], rowCount: 1 };
    });
    await persistSocialEvent(pool as never, {
      platform: 'instagram',
      accountId: 'ig-1',
      kind: 'comment',
      raw: { nested: { works: true } },
    });
    // raw is the last positional arg before $14 (i.e. index 13)
    expect(typeof captured[13]).toBe('string');
    expect(JSON.parse(String(captured[13]))).toEqual({ nested: { works: true } });
  });

  it('survives DB throw and reports inserted=false', async () => {
    const pool = makePool(async () => {
      throw new Error('db down');
    });
    const r = await persistSocialEvent(pool as never, {
      platform: 'instagram',
      accountId: 'ig-1',
      kind: 'comment',
      raw: {},
    });
    expect(r).toEqual({ inserted: false, id: null });
  });
});

// ── listPendingSentimentEvents + setEventSentiment ──────────────────────

describe('listPendingSentimentEvents', () => {
  it('queries sentiment_processed_at IS NULL with limit', async () => {
    let capturedSql = '';
    let capturedArgs: unknown[] = [];
    const pool = makePool(async (sql, args) => {
      capturedSql = sql;
      capturedArgs = args;
      return { rows: [{ id: 'e1', platform: 'instagram', body: 'hei', language: null }] };
    });
    const rows = await listPendingSentimentEvents(pool as never, 10);
    expect(capturedSql).toContain('sentiment_processed_at IS NULL');
    expect(capturedArgs).toEqual([10]);
    expect(rows).toHaveLength(1);
  });
});

describe('setEventSentiment', () => {
  it('UPDATEs the row with score, label, model, processed_at', async () => {
    let capturedSql = '';
    let capturedArgs: unknown[] = [];
    const pool = makePool(async (sql, args) => {
      capturedSql = sql;
      capturedArgs = args;
      return { rows: [], rowCount: 1 };
    });
    await setEventSentiment(pool as never, 'evt-9', 0.85, 'positive', 'claude-haiku-test');
    expect(capturedSql).toContain('UPDATE social_events');
    expect(capturedSql).toContain('sentiment_processed_at = now()');
    expect(capturedArgs).toEqual(['evt-9', 0.85, 'positive', 'claude-haiku-test']);
  });
});
