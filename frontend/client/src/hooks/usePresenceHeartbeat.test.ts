import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getAuthHeadersSync } = vi.hoisted(() => ({
  getAuthHeadersSync: vi.fn(() => ({ Authorization: 'Bearer active-role-room-token' })),
}));

vi.mock('../components/role-room/services/authSessionService', () => ({
  default: { getAuthHeadersSync },
}));

import { usePresenceHeartbeat } from './usePresenceHeartbeat';

describe('usePresenceHeartbeat', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getAuthHeadersSync.mockClear();
  });

  it('uses the active Role Room session headers for the first heartbeat', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const { unmount } = renderHook(() => usePresenceHeartbeat(true));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/presence/heartbeat', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      headers: expect.objectContaining({
        Authorization: 'Bearer active-role-room-token',
      }),
    }));

    unmount();
  });
});
