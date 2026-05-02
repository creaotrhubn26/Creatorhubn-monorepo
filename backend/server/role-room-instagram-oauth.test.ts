import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ensure the AES key is deterministic before any module imports.
process.env.AUTH_SECRET = 'role-room-oauth-test-secret';

import {
  buildAuthorizationUrl,
  decryptInstagramToken,
  encryptInstagramToken,
  ensureFreshConnection,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchMetaUserId,
  discoverIgBusinessAccounts,
  getConnection,
  listInstagramConnections,
  META_REQUIRED_SCOPES,
  revokeConnection,
  signOauthState,
  upsertInstagramConnection,
  verifyOauthState,
  type InstagramConnectionRow,
} from './role-room-instagram-oauth';

// ── Fetch mocking ────────────────────────────────────────────────────────

type FetchHandler = (url: string, init?: RequestInit) => Promise<{ status: number; body: unknown }>;
let fetchHandler: FetchHandler = async () => ({ status: 500, body: { error: 'unmocked' } });
const fetchCalls: { url: string; init?: RequestInit }[] = [];

beforeEach(() => {
  fetchCalls.length = 0;
  fetchHandler = async () => ({ status: 500, body: { error: 'unmocked' } });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    const { status, body } = await fetchHandler(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  });
  process.env.META_APP_ID = 'test-app-id';
  process.env.META_APP_SECRET = 'test-app-secret';
  process.env.META_OAUTH_REDIRECT_URI = 'https://example.test/ig/cb';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.META_LOGIN_CONFIG_ID;
});

// ── Encryption ────────────────────────────────────────────────────────────

describe('encryptInstagramToken + decryptInstagramToken', () => {
  it('round-trips a token', () => {
    const enc = encryptInstagramToken('hunter2');
    expect(enc).toMatch(/^v1\./);
    expect(decryptInstagramToken(enc)).toBe('hunter2');
  });

  it('returns null when the ciphertext is malformed', () => {
    expect(decryptInstagramToken('not-a-real-token')).toBeNull();
    expect(decryptInstagramToken('v1.onlyonepart')).toBeNull();
  });

  it('returns null when decryption fails on a tampered ciphertext', () => {
    const enc = encryptInstagramToken('real-token')!;
    // Flip a bit in the ciphertext part.
    const [v, iv, tag, ct] = enc.split('.');
    const tamperedCt = ct.slice(0, -2) + (ct.endsWith('A') ? 'B' : 'A');
    const tampered = [v, iv, tag, tamperedCt].join('.');
    expect(decryptInstagramToken(tampered)).toBeNull();
  });

  it('returns null for null/empty input', () => {
    expect(encryptInstagramToken(null)).toBeNull();
    expect(encryptInstagramToken('')).toBeNull();
    expect(decryptInstagramToken(null)).toBeNull();
  });
});

// ── OAuth state ──────────────────────────────────────────────────────────

describe('signOauthState + verifyOauthState', () => {
  it('round-trips a fresh state with the claims intact', () => {
    const state = signOauthState({ userId: 'u1', projectId: 'p2' });
    const claims = verifyOauthState(state);
    expect(claims?.userId).toBe('u1');
    expect(claims?.projectId).toBe('p2');
  });

  it('rejects a null or missing state', () => {
    expect(verifyOauthState(null)).toBeNull();
    expect(verifyOauthState(undefined)).toBeNull();
    expect(verifyOauthState('')).toBeNull();
  });

  it('rejects a state with a broken signature', () => {
    const state = signOauthState({ userId: 'u1' });
    const [payload] = state.split('.');
    const tampered = `${payload}.deadbeef`;
    expect(verifyOauthState(tampered)).toBeNull();
  });

  it('rejects a state older than 10 minutes', () => {
    const realNow = Date.now;
    const baseline = new Date('2026-04-18T10:00:00Z').getTime();
    Date.now = () => baseline;
    const state = signOauthState({ userId: 'u1' });
    // Fast-forward 11 minutes.
    Date.now = () => baseline + 11 * 60 * 1000;
    try {
      expect(verifyOauthState(state)).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });
});

// ── Authorization URL ─────────────────────────────────────────────────────

describe('buildAuthorizationUrl', () => {
  it('returns null when META config is absent', () => {
    delete process.env.META_APP_ID;
    expect(buildAuthorizationUrl('state')).toBeNull();
  });

  it('uses classic FB Login (scope + auth_type) when META_LOGIN_CONFIG_ID is unset', () => {
    const url = buildAuthorizationUrl('abc');
    expect(url).not.toBeNull();
    const params = new URL(url!).searchParams;
    expect(params.get('client_id')).toBe('test-app-id');
    expect(params.get('redirect_uri')).toBe('https://example.test/ig/cb');
    expect(params.get('state')).toBe('abc');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('scope')).toBe(META_REQUIRED_SCOPES.join(','));
    expect(params.get('auth_type')).toBe('rerequest');
    expect(params.get('config_id')).toBeNull();
  });

  it('switches to FB Login for Business (config_id, no scope) when META_LOGIN_CONFIG_ID is set', () => {
    process.env.META_LOGIN_CONFIG_ID = 'cfg-99';
    const url = buildAuthorizationUrl('abc')!;
    const params = new URL(url).searchParams;
    expect(params.get('config_id')).toBe('cfg-99');
    expect(params.get('scope')).toBeNull();
    expect(params.get('auth_type')).toBeNull();
  });

  it('trims whitespace from META_LOGIN_CONFIG_ID and treats empty as unset', () => {
    process.env.META_LOGIN_CONFIG_ID = '   ';
    const url = buildAuthorizationUrl('abc')!;
    expect(new URL(url).searchParams.get('config_id')).toBeNull();
    expect(new URL(url).searchParams.get('scope')).not.toBeNull();
  });
});

// ── Token exchange ───────────────────────────────────────────────────────

describe('exchangeCodeForShortLivedToken', () => {
  it('passes code + redirect + client creds and parses access_token', async () => {
    fetchHandler = async () => ({
      status: 200,
      body: { access_token: 'short-abc', expires_in: 3600 },
    });
    const result = await exchangeCodeForShortLivedToken('code-123');
    expect(result.accessToken).toBe('short-abc');
    expect(result.expiresIn).toBe(3600);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain('code=code-123');
    expect(fetchCalls[0].url).toContain('client_id=test-app-id');
    expect(fetchCalls[0].url).toContain('client_secret=test-app-secret');
  });

  it('throws when the response has no access_token', async () => {
    fetchHandler = async () => ({ status: 200, body: {} });
    await expect(exchangeCodeForShortLivedToken('x')).rejects.toThrow(/ingen access_token/);
  });

  it('throws with the Meta error message when the response is non-2xx', async () => {
    fetchHandler = async () => ({
      status: 400,
      body: { error: { message: 'Invalid OAuth code', code: 100 } },
    });
    await expect(exchangeCodeForShortLivedToken('x')).rejects.toThrow(/Invalid OAuth code/);
  });
});

describe('exchangeForLongLivedToken', () => {
  it('returns the long-lived token and falls back to 60-day expiry if Meta omits expires_in', async () => {
    fetchHandler = async () => ({ status: 200, body: { access_token: 'long-abc' } });
    const result = await exchangeForLongLivedToken('short');
    expect(result.accessToken).toBe('long-abc');
    expect(result.expiresIn).toBe(5_184_000);
  });
});

describe('fetchMetaUserId', () => {
  it('returns the id field on success', async () => {
    fetchHandler = async () => ({ status: 200, body: { id: 'fb-123' } });
    expect(await fetchMetaUserId('token')).toBe('fb-123');
  });

  it('returns null if Meta errors (caller does not treat this as fatal)', async () => {
    fetchHandler = async () => ({ status: 400, body: { error: { message: 'bad token' } } });
    expect(await fetchMetaUserId('token')).toBeNull();
  });
});

// ── Page / IG account discovery ─────────────────────────────────────────

describe('discoverIgBusinessAccounts', () => {
  it('returns one entry per page that has a BUSINESS/CREATOR IG account attached', async () => {
    fetchHandler = async (url) => {
      if (url.includes('/me/accounts')) {
        return {
          status: 200,
          body: {
            data: [
              { id: 'page-1', name: 'Studio', access_token: 'pat-1' },
              { id: 'page-2', name: 'Personal', access_token: 'pat-2' },
            ],
          },
        };
      }
      if (url.includes('/page-1?')) {
        return { status: 200, body: { instagram_business_account: { id: 'ig-1' } } };
      }
      if (url.includes('/page-2?')) {
        // No IG account attached — should be skipped.
        return { status: 200, body: {} };
      }
      if (url.includes('/ig-1?')) {
        return {
          status: 200,
          body: {
            username: 'studio_official',
            account_type: 'BUSINESS',
            profile_picture_url: 'https://cdn.meta.example/avatar.jpg',
            followers_count: 1240,
            media_count: 87,
          },
        };
      }
      return { status: 404, body: {} };
    };
    const accounts = await discoverIgBusinessAccounts('user-token');
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      pageId: 'page-1',
      pageName: 'Studio',
      pageAccessToken: 'pat-1',
      igBusinessAccountId: 'ig-1',
      igUsername: 'studio_official',
    });
    expect(accounts[0].profile).toMatchObject({
      username: 'studio_official',
      accountType: 'BUSINESS',
      profilePictureUrl: 'https://cdn.meta.example/avatar.jpg',
      followersCount: 1240,
      mediaCount: 87,
    });
  });

  it('rejects PERSONAL Instagram accounts (Meta App Review policy)', async () => {
    fetchHandler = async (url) => {
      if (url.includes('/me/accounts')) {
        return { status: 200, body: { data: [{ id: 'p1', name: 'P', access_token: 'pat' }] } };
      }
      if (url.includes('/p1?')) {
        return { status: 200, body: { instagram_business_account: { id: 'ig-9' } } };
      }
      if (url.includes('/ig-9?')) {
        return {
          status: 200,
          body: { username: 'me', account_type: 'PERSONAL' },
        };
      }
      return { status: 404, body: {} };
    };
    const accounts = await discoverIgBusinessAccounts('token');
    expect(accounts).toHaveLength(0);
  });

  it('skips IG accounts when profile metadata fetch fails (no account_type to gate on)', async () => {
    fetchHandler = async (url) => {
      if (url.includes('/me/accounts')) {
        return { status: 200, body: { data: [{ id: 'p1', name: 'P', access_token: 'pat' }] } };
      }
      if (url.includes('/p1?')) {
        return { status: 200, body: { instagram_business_account: { id: 'ig-9' } } };
      }
      if (url.includes('/ig-9?')) {
        return { status: 500, body: { error: { message: 'meta hiccup' } } };
      }
      return { status: 404, body: {} };
    };
    const accounts = await discoverIgBusinessAccounts('token');
    expect(accounts).toHaveLength(0);
  });

  it('returns an empty array when the user has no FB pages', async () => {
    fetchHandler = async () => ({ status: 200, body: { data: [] } });
    expect(await discoverIgBusinessAccounts('token')).toEqual([]);
  });
});

// ── Connection persistence ──────────────────────────────────────────────

function makePool(impl: (sql: string, args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }> | { rows: unknown[]; rowCount?: number }) {
  return { query: vi.fn(async (sql: string, args: unknown[] = []) => impl(sql, args)) };
}

describe('upsertInstagramConnection', () => {
  it('encrypts the token before INSERT and returns a mapped row', async () => {
    let capturedSql = '';
    let capturedArgs: unknown[] = [];
    const pool = makePool(async (sql, args) => {
      capturedSql = sql;
      capturedArgs = args;
      const encrypted = String(args[7]);
      return {
        rows: [
          {
            id: 'row-1',
            user_id: 'u1',
            project_id: null,
            ig_business_account_id: 'ig-9',
            ig_username: 'studio',
            facebook_page_id: 'p1',
            facebook_page_name: 'Studio',
            fb_user_id: 'fb-1',
            access_token_encrypted: encrypted,
            token_expires_at: new Date(),
            scopes: ['instagram_basic'],
            connection_state: 'connected',
            last_error: null,
          },
        ],
      };
    });
    const row = await upsertInstagramConnection(pool as never, {
      userId: 'u1',
      projectId: null,
      page: {
        pageId: 'p1',
        pageName: 'Studio',
        pageAccessToken: 'pat',
        igBusinessAccountId: 'ig-9',
        igUsername: 'studio',
        profile: {
          username: 'studio',
          accountType: 'BUSINESS',
          profilePictureUrl: null,
          followersCount: 100,
          mediaCount: 5,
        },
      },
      longLivedToken: 'long-tok',
      expiresInSeconds: 5_184_000,
      scopes: ['instagram_basic'],
      fbUserId: 'fb-1',
    });
    expect(row?.accessToken).toBe('long-tok');
    expect(capturedSql).toContain('INSERT INTO role_room_instagram_connections');
    expect(capturedArgs[0]).toBe('u1');
    expect(capturedArgs[6]).toBe('fb-1');
    // token arg is position 7 (0-indexed) and must be encrypted, not raw.
    expect(capturedArgs[7]).not.toBe('long-tok');
    expect(String(capturedArgs[7])).toMatch(/^v1\./);
  });

  it('returns null when the INSERT fails', async () => {
    const pool = makePool(async () => {
      throw new Error('unique violation');
    });
    const row = await upsertInstagramConnection(pool as never, {
      userId: 'u1',
      projectId: null,
      page: {
        pageId: 'p1',
        pageName: 'Studio',
        pageAccessToken: 'pat',
        igBusinessAccountId: 'ig-9',
        igUsername: null,
        profile: {
          username: null,
          accountType: 'BUSINESS',
          profilePictureUrl: null,
          followersCount: null,
          mediaCount: null,
        },
      },
      longLivedToken: 't',
      expiresInSeconds: 60,
      scopes: [],
      fbUserId: null,
    });
    expect(row).toBeNull();
  });
});

describe('listInstagramConnections + getConnection + revokeConnection', () => {
  it('lists only connected rows for the user', async () => {
    const pool = makePool(async (sql, args) => {
      expect(sql).toContain("WHERE user_id = $1 AND connection_state = 'connected'");
      expect(args).toEqual(['u1']);
      return { rows: [] };
    });
    expect(await listInstagramConnections(pool as never, 'u1')).toEqual([]);
  });

  it('getConnection returns null when the user does not own the row', async () => {
    const pool = makePool(async () => ({ rows: [] }));
    expect(await getConnection(pool as never, 'conn-1', 'other-user')).toBeNull();
  });

  it('revokeConnection returns true when row exists, was connected, and UPDATE succeeds', async () => {
    // revokeConnection fetcher først (SELECT), så UPDATE.
    // For SELECT-spørringen returnerer vi en connected row;
    // for UPDATE returnerer vi rowCount=1.
    const yes = makePool(async (sql) => {
      if (sql.includes('SELECT')) {
        return {
          rows: [
            {
              id: 'c',
              user_id: 'u',
              project_id: null,
              ig_business_account_id: 'ig',
              ig_username: 'u',
              facebook_page_id: 'p',
              facebook_page_name: null,
              fb_user_id: null,
              access_token_encrypted: 'v1.aa.bb.cc',
              token_expires_at: null,
              scopes: [],
              connection_state: 'connected',
              last_error: null,
            },
          ],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    expect(await revokeConnection(yes as never, 'c', 'u')).toBe(true);

    // No row found → returns false uten å forsøke UPDATE.
    const no = makePool(async () => ({ rows: [] }));
    expect(await revokeConnection(no as never, 'c', 'u')).toBe(false);
  });
});

// ── ensureFreshConnection ────────────────────────────────────────────────

function makeConnection(override: Partial<InstagramConnectionRow> = {}): InstagramConnectionRow {
  return {
    id: 'c1',
    userId: 'u1',
    projectId: null,
    igBusinessAccountId: 'ig',
    igUsername: 'u',
    facebookPageId: 'p',
    facebookPageName: 'P',
    fbUserId: null,
    accessToken: 'current-long-token',
    tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    scopes: [],
    connectionState: 'connected',
    lastError: null,
    accountType: 'BUSINESS',
    profilePictureUrl: null,
    followersCount: null,
    mediaCount: null,
    profileRefreshedAt: null,
    ...override,
  };
}

describe('ensureFreshConnection', () => {
  it('passes through when the token is far from expiry', async () => {
    const pool = makePool(async () => ({ rows: [] }));
    const conn = makeConnection();
    const result = await ensureFreshConnection(pool as never, conn);
    expect(result).toBe(conn);
    // No refresh call.
    expect(fetchCalls).toHaveLength(0);
  });

  it('refreshes via fb_exchange_token when within 24h of expiry', async () => {
    fetchHandler = async () => ({
      status: 200,
      body: { access_token: 'refreshed-long', expires_in: 5_184_000 },
    });
    let updatedWith: unknown[] = [];
    const pool = makePool(async (sql, args) => {
      expect(sql).toContain('UPDATE role_room_instagram_connections');
      updatedWith = args;
      return { rows: [], rowCount: 1 };
    });
    const conn = makeConnection({
      tokenExpiresAt: new Date(Date.now() + 60_000),
    });
    const result = await ensureFreshConnection(pool as never, conn);
    expect(result.accessToken).toBe('refreshed-long');
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain('grant_type=fb_exchange_token');
    // Encrypted token written, not raw.
    expect(String(updatedWith[1])).toMatch(/^v1\./);
  });

  it('marks the connection expired and rethrows if Meta refuses to refresh', async () => {
    fetchHandler = async () => ({
      status: 400,
      body: { error: { message: 'token revoked', code: 190 } },
    });
    const updates: string[] = [];
    const pool = makePool(async (sql) => {
      updates.push(sql);
      return { rows: [], rowCount: 1 };
    });
    const conn = makeConnection({ tokenExpiresAt: new Date(Date.now() + 60_000) });
    await expect(ensureFreshConnection(pool as never, conn)).rejects.toThrow(/token revoked/);
    expect(updates.some((s) => s.includes("connection_state = 'expired'"))).toBe(true);
  });
});
