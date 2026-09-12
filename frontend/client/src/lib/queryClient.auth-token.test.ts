import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearClientAuthState, getAuthHeader, getStoredAuthToken } from './queryClient';

const values = new Map<string, string>();
const localStorageMock: Storage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => Array.from(values.keys())[index] ?? null,
  removeItem: (key) => { values.delete(key); },
  setItem: (key, value) => { values.set(key, String(value)); },
};

beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('window', {
    localStorage: localStorageMock,
    location: { hostname: 'localhost', pathname: '/' },
    dispatchEvent: vi.fn(),
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Role Room bearer-token contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hostname = 'localhost';
    window.location.pathname = '/';
  });

  it('falls back to the Role Room token when CreatorHub auth is absent', async () => {
    window.localStorage.setItem('role_room_auth_token', '  rr-session-token  ');

    expect(getStoredAuthToken()).toBe('rr-session-token');
    await expect(getAuthHeader()).resolves.toMatchObject({
      Authorization: 'Bearer rr-session-token',
    });
  });

  it('keeps the CreatorHub token as the canonical first choice', () => {
    window.localStorage.setItem('creatorhub_auth_token', 'creatorhub-session');
    window.localStorage.setItem('role_room_auth_token', 'role-room-session');

    expect(getStoredAuthToken()).toBe('creatorhub-session');
  });

  it('prefers the Role Room token on the dedicated Role Room host', async () => {
    window.location.hostname = 'theroleroom.com';
    window.localStorage.setItem('creatorhub_auth_token', 'stale-creatorhub-session');
    window.localStorage.setItem('role_room_auth_token', 'fresh-role-room-session');

    expect(getStoredAuthToken()).toBe('fresh-role-room-session');
    await expect(getAuthHeader()).resolves.toMatchObject({
      Authorization: 'Bearer fresh-role-room-session',
    });
  });

  it('recovers the Role Room token from the persisted session object', () => {
    window.location.hostname = 'theroleroom.com';
    window.localStorage.setItem('role_room_auth_session', JSON.stringify({
      sessionToken: 'persisted-role-room-session',
    }));

    expect(getStoredAuthToken()).toBe('persisted-role-room-session');
  });

  it('supports the legacy generic token fallback', () => {
    window.localStorage.setItem('token', 'legacy-session');

    expect(getStoredAuthToken()).toBe('legacy-session');
  });

  it('supports the legacy Admin Room authToken fallback', () => {
    window.localStorage.setItem('authToken', 'legacy-admin-session');

    expect(getStoredAuthToken()).toBe('legacy-admin-session');
  });

  it('returns an empty token when storage has no auth state', async () => {
    expect(getStoredAuthToken()).toBe('');
    await expect(getAuthHeader()).resolves.not.toHaveProperty('Authorization');
  });

  it('clears CreatorHub and Role Room auth state together', () => {
    window.localStorage.setItem('creatorhub_auth_token', 'creatorhub-session');
    window.localStorage.setItem('role_room_auth_token', 'role-room-session');
    window.localStorage.setItem('role_room_auth_session', '{"sessionToken":"role-room-session"}');

    clearClientAuthState();

    expect(window.localStorage.getItem('creatorhub_auth_token')).toBeNull();
    expect(window.localStorage.getItem('role_room_auth_token')).toBeNull();
    expect(window.localStorage.getItem('role_room_auth_session')).toBeNull();
  });
});
