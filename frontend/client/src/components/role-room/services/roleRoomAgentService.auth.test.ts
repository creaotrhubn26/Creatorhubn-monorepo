import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  canUseLocalDevAdminSession: vi.fn(),
  getAuthHeadersSync: vi.fn(),
  getSessionSync: vi.fn(),
}));

vi.mock('../../../hooks/devAdminSessionGuard', () => ({
  canUseLocalDevAdminSession: mocks.canUseLocalDevAdminSession,
  DEV_ADMIN_SESSION_TOKEN: 'dev-admin-local-session',
}));

vi.mock('./authSessionService', () => ({
  authSessionService: {
    getAuthHeadersSync: mocks.getAuthHeadersSync,
    getSessionSync: mocks.getSessionSync,
  },
}));

import { roleRoomAgentDefaultHeaders } from './roleRoomAgentService';

describe('Role Room Agent local development authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthHeadersSync.mockReturnValue({});
    mocks.getSessionSync.mockReturnValue({});
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injects the dev admin token only when the shared runtime guard allows it', () => {
    mocks.canUseLocalDevAdminSession.mockReturnValue(true);

    expect(roleRoomAgentDefaultHeaders()).toEqual({
      Authorization: 'Bearer dev-admin-local-session',
    });
    expect(mocks.canUseLocalDevAdminSession).toHaveBeenCalledWith(
      import.meta.env.DEV,
      window.location.hostname,
      import.meta.env.VITE_ENABLE_LOCAL_ADMIN_SESSION,
    );
  });

  it('does not inject the dev admin token when the shared runtime guard rejects the host', () => {
    mocks.canUseLocalDevAdminSession.mockReturnValue(false);

    expect(roleRoomAgentDefaultHeaders()).toEqual({});
  });

  it('preserves an existing authenticated session header without consulting the fallback guard', () => {
    mocks.getAuthHeadersSync.mockReturnValue({ Authorization: 'Bearer real-session' });

    expect(roleRoomAgentDefaultHeaders()).toEqual({ Authorization: 'Bearer real-session' });
    expect(mocks.canUseLocalDevAdminSession).not.toHaveBeenCalled();
  });
});
