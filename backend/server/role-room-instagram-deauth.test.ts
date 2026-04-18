import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import {
  fetchDataDeletionRequest,
  parseSignedRequest,
  recordDataDeletionRequest,
  revokeConnectionsForFbUser,
} from './role-room-instagram-deauth';

const APP_SECRET = 'test-app-secret';

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildSignedRequest(payload: Record<string, unknown>, secret: string): string {
  const json = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(json, 'utf8'));
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  return `${base64UrlEncode(sig)}.${payloadB64}`;
}

describe('parseSignedRequest', () => {
  it('returns the payload for a valid signed_request', () => {
    const sr = buildSignedRequest(
      { algorithm: 'HMAC-SHA256', issued_at: 1700000000, user_id: '123456789' },
      APP_SECRET,
    );
    const payload = parseSignedRequest(sr, APP_SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.user_id).toBe('123456789');
  });

  it('rejects when the secret does not match', () => {
    const sr = buildSignedRequest(
      { algorithm: 'HMAC-SHA256', user_id: '1' },
      APP_SECRET,
    );
    expect(parseSignedRequest(sr, 'wrong-secret')).toBeNull();
  });

  it('rejects a missing dot-separator', () => {
    expect(parseSignedRequest('nodothere', APP_SECRET)).toBeNull();
  });

  it('rejects an empty input', () => {
    expect(parseSignedRequest('', APP_SECRET)).toBeNull();
    expect(parseSignedRequest(undefined, APP_SECRET)).toBeNull();
  });

  it('rejects a non-HMAC-SHA256 algorithm', () => {
    const sr = buildSignedRequest({ algorithm: 'PLAIN', user_id: '1' }, APP_SECRET);
    expect(parseSignedRequest(sr, APP_SECRET)).toBeNull();
  });

  it('rejects when payload JSON is malformed', () => {
    const payloadB64 = base64UrlEncode(Buffer.from('not json', 'utf8'));
    const sig = crypto.createHmac('sha256', APP_SECRET).update(payloadB64).digest();
    const sr = `${base64UrlEncode(sig)}.${payloadB64}`;
    expect(parseSignedRequest(sr, APP_SECRET)).toBeNull();
  });

  it('tolerates base64url alphabet (no padding, - and _)', () => {
    // Pick a payload whose base64 contains +, /, and padding to exercise the
    // base64url normalisation path.
    const sr = buildSignedRequest(
      { algorithm: 'HMAC-SHA256', user_id: 'abc>?&=' },
      APP_SECRET,
    );
    const payload = parseSignedRequest(sr, APP_SECRET);
    expect(payload?.user_id).toBe('abc>?&=');
  });
});

interface PoolStub {
  query: ReturnType<typeof vi.fn>;
}

function makePool(impl: (sql: string, args: unknown[]) => { rows: unknown[]; rowCount?: number } | Promise<{ rows: unknown[]; rowCount?: number }>): PoolStub {
  const query = vi.fn(async (sql: string, args: unknown[] = []) => impl(sql, args));
  return { query } as unknown as PoolStub;
}

describe('revokeConnectionsForFbUser', () => {
  it('updates connected rows matching fb_user_id', async () => {
    const pool = makePool(async (sql, args) => {
      expect(sql).toContain('UPDATE role_room_instagram_connections');
      expect(sql).toContain("connection_state = 'revoked'");
      expect(args).toEqual(['fb-123']);
      return { rows: [], rowCount: 3 };
    });
    const n = await revokeConnectionsForFbUser(pool as never, 'fb-123');
    expect(n).toBe(3);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('returns 0 on query error', async () => {
    const pool = makePool(async () => {
      throw new Error('db offline');
    });
    const n = await revokeConnectionsForFbUser(pool as never, 'fb-9');
    expect(n).toBe(0);
  });
});

describe('recordDataDeletionRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('revokes connections, logs the request, and returns confirmation + count', async () => {
    const calls: { sql: string; args: unknown[] }[] = [];
    const pool = makePool(async (sql, args) => {
      calls.push({ sql, args });
      if (sql.startsWith('UPDATE')) return { rows: [], rowCount: 2 };
      if (sql.startsWith('INSERT')) return { rows: [], rowCount: 1 };
      return { rows: [] };
    });
    const result = await recordDataDeletionRequest(pool as never, 'fb-777');
    expect(result.connectionsRevoked).toBe(2);
    expect(result.confirmationCode).toMatch(/^[0-9a-f]{32}$/);
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain('UPDATE role_room_instagram_connections');
    expect(calls[1].sql).toContain('INSERT INTO role_room_meta_data_deletion_requests');
    // The INSERT uses the same confirmation code we returned.
    expect(calls[1].args[0]).toBe(result.confirmationCode);
    // The INSERT uses the same fb_user_id we passed in.
    expect(calls[1].args[1]).toBe('fb-777');
    // The INSERT records the revoke count.
    expect(calls[1].args[2]).toBe(2);
  });

  it('still returns a confirmation code if the INSERT fails', async () => {
    const pool = makePool(async (sql) => {
      if (sql.startsWith('UPDATE')) return { rows: [], rowCount: 1 };
      throw new Error('insert failed');
    });
    const result = await recordDataDeletionRequest(pool as never, 'fb-1');
    expect(result.confirmationCode).toMatch(/^[0-9a-f]{32}$/);
    expect(result.connectionsRevoked).toBe(1);
  });
});

describe('fetchDataDeletionRequest', () => {
  it('returns null when no row matches', async () => {
    const pool = makePool(async () => ({ rows: [] }));
    expect(await fetchDataDeletionRequest(pool as never, 'missing')).toBeNull();
  });

  it('maps a row to the record shape', async () => {
    const pool = makePool(async () => ({
      rows: [
        {
          confirmation_code: 'abc',
          fb_user_id: 'fb-1',
          requested_at: new Date('2026-04-18T10:00:00Z'),
          status: 'completed',
          connections_revoked: 3,
          completed_at: new Date('2026-04-18T10:00:01Z'),
          last_error: null,
        },
      ],
    }));
    const r = await fetchDataDeletionRequest(pool as never, 'abc');
    expect(r?.confirmationCode).toBe('abc');
    expect(r?.fbUserId).toBe('fb-1');
    expect(r?.status).toBe('completed');
    expect(r?.connectionsRevoked).toBe(3);
    expect(r?.completedAt?.toISOString()).toBe('2026-04-18T10:00:01.000Z');
  });
});
