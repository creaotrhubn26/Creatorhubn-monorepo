import { afterEach, describe, expect, it, vi } from 'vitest';

// Stub the Claude client so the service never makes a network call. The mock
// echoes a fixed draft and records that it was (or wasn't) invoked.
const runClaudeAgentMock = vi.fn(async () => ({
  text: '  Tusen takk for tilbakemeldingen! ',
  toolUses: [],
  usage: { inputTokens: 10, outputTokens: 5 },
  model: 'claude-test',
  latencyMs: 1,
}));

vi.mock('./role-room-agent-claude.js', () => ({
  runClaudeAgent: (...args: unknown[]) => runClaudeAgentMock(...args),
}));

import { draftInboxReply } from './role-room-agent-inbox-reply.js';

type QueryResult = { rows: unknown[]; rowCount: number };

function makePool(handler: (sql: string, params: unknown[]) => QueryResult) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return handler(sql, params);
    }),
  };
  return { pool: pool as unknown as import('pg').Pool, calls };
}

afterEach(() => {
  runClaudeAgentMock.mockClear();
});

describe('draftInboxReply ownership scoping', () => {
  it('scopes the lookup by id AND the owned-account subquery, binding the userId', async () => {
    const { pool, calls } = makePool(() => ({
      rows: [{ platform: 'instagram', kind: 'comment', body: 'Elsker dette!' }],
      rowCount: 1,
    }));

    const result = await draftInboxReply(pool, { userId: 'user-1', eventId: 'evt-1' });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const { sql, params } = calls[0];
    // id-scoped + owned-account subquery present.
    expect(sql).toContain('FROM social_events');
    expect(sql).toContain('id::text = $1');
    expect(sql).toContain('account_id IN');
    expect(sql).toContain('role_room_instagram_connections');
    expect(sql).toContain('role_room_linkedin_connections');
    expect(sql).toContain('role_room_google_connections');
    // Caller's id is bound for both the id and the user param.
    expect(params).toEqual(['evt-1', 'user-1']);
  });

  it('returns not_owned and does NOT call Claude when the row is not the caller\'s', async () => {
    // Scoped query returns no row → treated as not owned / not found.
    const { pool } = makePool(() => ({ rows: [], rowCount: 0 }));

    const result = await draftInboxReply(pool, { userId: 'user-2', eventId: 'evt-x' });

    expect(result).toEqual({ ok: false, error: 'not_owned' });
    expect(runClaudeAgentMock).not.toHaveBeenCalled();
  });

  it('returns no_body (and skips Claude) for an owned event with empty text', async () => {
    const { pool } = makePool(() => ({
      rows: [{ platform: 'instagram', kind: 'reaction', body: '   ' }],
      rowCount: 1,
    }));

    const result = await draftInboxReply(pool, { userId: 'user-1', eventId: 'evt-2' });

    expect(result).toEqual({ ok: false, error: 'no_body' });
    expect(runClaudeAgentMock).not.toHaveBeenCalled();
  });

  it('sends ONLY the comment body + platform to Claude (no author names) and trims the draft', async () => {
    const { pool } = makePool(() => ({
      rows: [{ platform: 'linkedin', kind: 'comment', body: 'Når åpner dere?' }],
      rowCount: 1,
    }));

    const result = await draftInboxReply(pool, {
      userId: 'user-1',
      eventId: 'evt-3',
      brandVoice: 'varm og kort',
    });

    expect(result).toEqual({ ok: true, draft: 'Tusen takk for tilbakemeldingen!', model: 'claude-test' });
    expect(runClaudeAgentMock).toHaveBeenCalledTimes(1);
    const arg = runClaudeAgentMock.mock.calls[0][0] as { userMessage: string; tools?: unknown };
    expect(arg.userMessage).toContain('Når åpner dere?');
    expect(arg.userMessage).toContain('LinkedIn');
    expect(arg.userMessage).toContain('varm og kort');
    // No tools wired for this single-shot draft.
    expect(arg.tools).toBeUndefined();
  });

  it('never throws; a query error resolves to ok:false', async () => {
    const { pool } = makePool(() => {
      throw new Error('db down');
    });

    const result = await draftInboxReply(pool, { userId: 'user-1', eventId: 'evt-4' });

    expect(result).toEqual({ ok: false, error: 'lookup_failed' });
  });

  it('rejects missing identifiers before touching the pool', async () => {
    const { pool, calls } = makePool(() => ({ rows: [], rowCount: 0 }));

    expect(await draftInboxReply(pool, { userId: '', eventId: 'evt-1' })).toEqual({
      ok: false,
      error: 'missing_user',
    });
    expect(await draftInboxReply(pool, { userId: 'user-1', eventId: '' })).toEqual({
      ok: false,
      error: 'missing_event',
    });
    expect(calls).toHaveLength(0);
  });
});
