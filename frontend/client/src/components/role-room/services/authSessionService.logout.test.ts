// @vitest-environment jsdom
// Utlogging må rydde Role Rooms egen sesjon, ikke bare creatorhub-nøklene.
// Målt i produksjon: POST /api/auth/logout svarte 200, siden lastet på nytt,
// og appen tegnet seg fortsatt som innlogget — fordi role_room_auth_token og
// role_room_auth_session lå igjen i localStorage.
import { beforeEach, describe, expect, it } from 'vitest';

import authSessionService from './authSessionService';

const ROLE_ROOM_KEYS = ['role_room_auth_token', 'role_room_auth_session'];

beforeEach(() => {
  window.localStorage.clear();
});

describe('authSessionService.clearSession', () => {
  it('removes the Role Room session that survives a creatorhub logout', async () => {
    for (const key of ROLE_ROOM_KEYS) {
      window.localStorage.setItem(key, 'noe-som-ligner-en-sesjon');
    }

    await authSessionService.clearSession();

    for (const key of ROLE_ROOM_KEYS) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
  });

  it('is safe to call when there is nothing to clear', async () => {
    await expect(authSessionService.clearSession()).resolves.toBeUndefined();
  });

  it('leaves no token behind for the next request to reuse', async () => {
    window.localStorage.setItem('role_room_auth_token', 'gammelt-token');

    await authSessionService.clearSession();
    const headers = authSessionService.getAuthHeadersSync();

    expect(JSON.stringify(headers)).not.toContain('gammelt-token');
  });
});
