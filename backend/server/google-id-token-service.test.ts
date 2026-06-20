import { describe, expect, it, vi } from 'vitest';
import {
  exchangeGoogleIdToken,
  splitClientIds,
  type ActiveSessionLike,
  type GoogleTokenPayload,
} from './google-id-token-service.js';

// We don't go near a real Postgres in the unit tests — pass a stub
// matching the slice of the Pool surface the service actually calls.
function makePoolStub(opts: {
  upsertResult?: { id: string; role: string | null }[];
  shouldThrow?: boolean;
} = {}) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const stub = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      if (opts.shouldThrow) throw new Error('pg unavailable');
      // The auth-session-store's CREATE TABLE check comes through the
      // same pool. Return an empty result for it; the service ignores it.
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('INSERT INTO creatorhub_auth_sessions')) return { rows: [] };
      if (sql.includes('INSERT INTO users')) {
        return { rows: opts.upsertResult ?? [{ id: 'user-uuid-1', role: 'user' }] };
      }
      return { rows: [] };
    }),
  } as unknown as import('pg').Pool;
  return { stub, calls };
}

const goodPayload: GoogleTokenPayload = {
  email: 'Daniel@CreatorhubN.COM',
  email_verified: true,
  name: 'Daniel Q',
  given_name: 'Daniel',
  family_name: 'Q',
  picture: 'https://lh3.googleusercontent.com/a/photo.jpg',
  sub: 'google-sub-1',
  aud: 'cid-1',
};

describe('exchangeGoogleIdToken', () => {
  it('rejects when idToken is missing', async () => {
    const { stub } = makePoolStub();
    const result = await exchangeGoogleIdToken({
      idToken: '',
      pool: stub,
      activeSessions: new Map(),
      clientIdOverride: 'cid',
      verifyOverride: async () => goodPayload,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe('idToken_required');
    }
  });

  it('returns 503 when no Google client id is configured', async () => {
    const { stub } = makePoolStub();
    delete process.env.CREATORHUB_GOOGLE_CLIENT_ID;
    const result = await exchangeGoogleIdToken({
      idToken: 'some.token.here',
      pool: stub,
      activeSessions: new Map(),
      verifyOverride: async () => goodPayload,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe('google_oauth_not_configured');
    }
  });

  it('rejects an unverified-email payload', async () => {
    const { stub } = makePoolStub();
    const result = await exchangeGoogleIdToken({
      idToken: 'token',
      pool: stub,
      activeSessions: new Map(),
      clientIdOverride: 'cid',
      verifyOverride: async () => ({ ...goodPayload, email_verified: false }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('email_not_verified');
    }
  });

  it('rejects when verifyIdToken throws', async () => {
    const { stub } = makePoolStub();
    const result = await exchangeGoogleIdToken({
      idToken: 'tampered.token',
      pool: stub,
      activeSessions: new Map(),
      clientIdOverride: 'cid',
      verifyOverride: async () => { throw new Error('signature mismatch'); },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('invalid_id_token');
      expect(result.detail).toContain('signature mismatch');
    }
  });

  it('upserts user, mints session, and returns lowercase email', async () => {
    const { stub, calls } = makePoolStub();
    const sessions = new Map<string, ActiveSessionLike>();
    const result = await exchangeGoogleIdToken({
      idToken: 'token',
      pool: stub,
      activeSessions: sessions,
      clientIdOverride: 'cid',
      verifyOverride: async () => goodPayload,
      tokenFactory: () => 'fixed-bearer-token',
      now: () => new Date('2026-04-18T03:00:00Z'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.token).toBe('fixed-bearer-token');
    // Email is normalised to lowercase + trim regardless of what Google returned.
    expect(result.user.email).toBe('daniel@creatorhubn.com');
    expect(result.user.id).toBe('user-uuid-1');
    expect(result.user.role).toBe('user');
    expect(result.user.profileImageUrl).toContain('googleusercontent');

    // The session is registered both in the in-memory map and persisted.
    expect(sessions.get('fixed-bearer-token')).toMatchObject({
      userId: 'user-uuid-1',
      email: 'daniel@creatorhubn.com',
      role: 'user',
    });
    const upsertCall = calls.find(c => c.sql.includes('INSERT INTO users'));
    // params: [email, username(=email), password, first_name, last_name, profile_image]
    expect(upsertCall?.params[0]).toBe('daniel@creatorhubn.com'); // email
    expect(upsertCall?.params[1]).toBe('daniel@creatorhubn.com'); // username
    expect(upsertCall?.params[3]).toBe('Daniel'); // first_name
    expect(upsertCall?.params[4]).toBe('Q');      // last_name
    // Regression: `username` AND `password` are both NOT NULL on users — a
    // first-time sign-in INSERT that omits either 500s the whole login. Both
    // must be in the column list; password is a bcrypt placeholder ($3).
    expect(upsertCall?.sql).toContain('username');
    expect(upsertCall?.sql).toContain('password');
    expect(upsertCall?.params[2]).toMatch(/^\$2[ayb]\$/);
    // Each column must use its OWN placeholder ($1..$6) — reusing one for
    // two columns throws "inconsistent types deduced for parameter $1".
    expect(upsertCall?.sql).toContain('VALUES ($1, $2, $3, $4, $5, $6');
  });

  it('falls back to email when name is missing', async () => {
    const { stub } = makePoolStub();
    const result = await exchangeGoogleIdToken({
      idToken: 'token',
      pool: stub,
      activeSessions: new Map(),
      clientIdOverride: 'cid',
      verifyOverride: async () => ({ email: 'no-name@x.com', email_verified: true }),
      tokenFactory: () => 't',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.name).toBe('no-name@x.com');
  });

  it('preserves existing role on subsequent logins', async () => {
    // The upsert returns 'admin' for an already-existing user; the service
    // should reflect that in the session, not coerce back to 'user'.
    const { stub } = makePoolStub({
      upsertResult: [{ id: 'admin-uuid', role: 'admin' }],
    });
    const result = await exchangeGoogleIdToken({
      idToken: 'token',
      pool: stub,
      activeSessions: new Map(),
      clientIdOverride: 'cid',
      verifyOverride: async () => goodPayload,
      tokenFactory: () => 't',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.role).toBe('admin');
  });

  it('accepts a token via the iPad-specific CAPTUREAPP_GOOGLE_CLIENT_ID', async () => {
    // The iPad CaptureApp's id-tokens carry the iOS OAuth-client ID
    // in their `aud` claim — different from the web client ID. Without
    // this env var the iPad got 401 invalid_id_token because the
    // audience mismatched the web/role-room ones.
    delete process.env.CREATORHUB_GOOGLE_CLIENT_ID;
    delete process.env.ROLE_ROOM_GOOGLE_CLIENT_ID;
    process.env.CAPTUREAPP_GOOGLE_CLIENT_ID =
      'ios-256648.apps.googleusercontent.com';
    const { stub } = makePoolStub();
    const result = await exchangeGoogleIdToken({
      idToken: 'token',
      pool: stub,
      activeSessions: new Map(),
      verifyOverride: async () => goodPayload,
      tokenFactory: () => 't',
    });
    delete process.env.CAPTUREAPP_GOOGLE_CLIENT_ID;
    expect(result.ok).toBe(true);
  });
});

describe('splitClientIds', () => {
  it('returns [] for missing or empty values', () => {
    expect(splitClientIds(undefined)).toEqual([]);
    expect(splitClientIds('')).toEqual([]);
    expect(splitClientIds('   ')).toEqual([]);
  });

  it('returns single-value envs unchanged', () => {
    expect(splitClientIds('abc.apps.googleusercontent.com'))
      .toEqual(['abc.apps.googleusercontent.com']);
  });

  it('splits comma-separated values + trims whitespace + drops empties', () => {
    // Accepts ops-friendly formats: ``A,B``, ``A, B``, trailing/leading
    // whitespace, empty trailing entries (`A,B,`).
    expect(
      splitClientIds(' ios-1.apps.googleusercontent.com , ios-2.apps.googleusercontent.com ,  '),
    ).toEqual([
      'ios-1.apps.googleusercontent.com',
      'ios-2.apps.googleusercontent.com',
    ]);
  });
});
