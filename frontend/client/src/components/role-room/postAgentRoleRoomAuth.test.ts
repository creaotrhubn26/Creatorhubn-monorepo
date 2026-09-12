import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./services/castingApiService', () => ({
  googleWorkspaceApi: {
    startOauth: vi.fn(),
    getOauthSessionResult: vi.fn(),
  },
}));

vi.mock('./services/authSessionService', () => ({
  default: {
    applyRoleRoomLogin: vi.fn(),
  },
}));

import authSessionService from './services/authSessionService';
import { googleWorkspaceApi } from './services/castingApiService';
import {
  buildPostAgentRoleRoomOauthInput,
  completePostAgentRoleRoomGoogleLogin,
  completePostAgentRoleRoomTwoFactorLogin,
  getCleanPostAgentReturnPath,
  getPostAgentBearerToken,
  startPostAgentRoleRoomGoogleLogin,
} from './postAgentRoleRoomAuth';

describe('Post Agent Role Room Google auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts the dedicated Role Room OAuth flow and preserves the pairing code', async () => {
    vi.mocked(googleWorkspaceApi.startOauth).mockResolvedValue({
      success: true,
      mode: 'login',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=role-room',
      stateId: 'state-1',
    });
    const navigate = vi.fn();
    const href = 'https://theroleroom.com/link?code=ABC-DEF';

    await startPostAgentRoleRoomGoogleLogin(href, navigate);

    expect(googleWorkspaceApi.startOauth).toHaveBeenCalledWith({
      mode: 'login',
      returnPath: '/link?code=ABC-DEF',
      browserOrigin: 'https://theroleroom.com',
    });
    expect(navigate).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=role-room',
    );
  });

  it('removes only Role Room OAuth callback parameters from the return path', () => {
    const href = 'https://theroleroom.com/link?code=ABC-DEF&rrGoogleStatus=success&rrGoogleMode=login&rrGoogleTransfer=t-1#pair';

    expect(getCleanPostAgentReturnPath(href)).toBe('/link?code=ABC-DEF#pair');
    expect(buildPostAgentRoleRoomOauthInput(href)).toEqual({
      mode: 'login',
      returnPath: '/link?code=ABC-DEF#pair',
      browserOrigin: 'https://theroleroom.com',
    });
  });

  it('consumes the one-time OAuth transfer and stores the Role Room session', async () => {
    vi.mocked(googleWorkspaceApi.getOauthSessionResult).mockResolvedValue({
      success: true,
      mode: 'login',
      transferId: 'transfer-1',
      sessionToken: 'role-room-session',
      user: {
        id: 'user-1',
        email: 'daniel@creatorhubn.com',
        role: 'admin',
        display_name: 'Daniel',
        requestedRole: null,
      },
      google: {
        email: 'daniel@creatorhubn.com',
        subject: 'google-subject',
        profile: {},
      },
    });

    await completePostAgentRoleRoomGoogleLogin('transfer-1');

    expect(authSessionService.applyRoleRoomLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        email: 'daniel@creatorhubn.com',
        role: 'admin',
      }),
      'role-room-session',
    );
  });

  it('completes the existing Role Room 2FA gate before storing the session', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        token: 'two-factor-session',
        user: {
          id: 'user-2',
          email: 'two-factor@example.com',
          role: 'user',
          name: 'Two Factor',
        },
      }),
    });

    await completePostAgentRoleRoomTwoFactorLogin('temp-token', ' 123456 ', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/auth/login/complete-2fa',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tempToken: 'temp-token', code: '123456' }),
      }),
    );
    expect(authSessionService.applyRoleRoomLogin).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'two-factor@example.com' }),
      'two-factor-session',
    );
  });

  it('prefers the Role Room token over a stale CreatorHub token', () => {
    const values: Record<string, string> = {
      creatorhub_auth_token: 'creatorhub-token',
      role_room_auth_token: 'role-room-token',
    };

    expect(getPostAgentBearerToken({ getItem: (key) => values[key] ?? null })).toBe(
      'role-room-token',
    );
  });
});
