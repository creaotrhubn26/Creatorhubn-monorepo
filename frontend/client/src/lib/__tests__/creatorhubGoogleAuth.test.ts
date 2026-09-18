import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CREATORHUB_AUTH_TOKEN_KEY,
  CREATORHUB_AUTH_USER_KEY,
  CREATORHUB_USER_EMAIL_KEY,
  CREATORHUB_USER_ID_KEY,
  storeCreatorHubAuthSession,
  type CreatorHubAuthUser,
} from '../creatorhubGoogleAuth';

const user: CreatorHubAuthUser = {
  id: 'user-1',
  email: 'owner@example.test',
  name: 'Owner',
  role: 'member',
  verified_email: true,
};

const originalStorage = window.localStorage;

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: originalStorage,
    configurable: true,
  });
  window.localStorage.clear();
});

afterEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: originalStorage,
    configurable: true,
  });
  window.localStorage.clear();
});

describe('CreatorHub auth session persistence', () => {
  it('reports success only after the complete session is stored', () => {
    expect(storeCreatorHubAuthSession('session-token', user)).toBe(true);
    expect(window.localStorage.getItem(CREATORHUB_AUTH_TOKEN_KEY)).toBe('session-token');
    expect(window.localStorage.getItem(CREATORHUB_AUTH_USER_KEY)).toBe(JSON.stringify(user));
    expect(window.localStorage.getItem(CREATORHUB_USER_ID_KEY)).toBe(user.id);
    expect(window.localStorage.getItem(CREATORHUB_USER_EMAIL_KEY)).toBe(user.email);
  });

  it('reports failure and removes a partial session when storage rejects a write', () => {
    const values = new Map<string, string>();
    const rejectingStorage: Storage = {
      get length() {
        return values.size;
      },
      key(index: number) {
        return Array.from(values.keys())[index] ?? null;
      },
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (key === CREATORHUB_AUTH_USER_KEY) {
          throw new DOMException('Storage blocked', 'SecurityError');
        }
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      },
      clear() {
        values.clear();
      },
    };
    Object.defineProperty(window, 'localStorage', {
      value: rejectingStorage,
      configurable: true,
    });

    expect(storeCreatorHubAuthSession('partial-token', user)).toBe(false);
    expect(values.size).toBe(0);
  });
});
