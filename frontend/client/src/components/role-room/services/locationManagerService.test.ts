// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { locationManagerService } from './locationManagerService';

vi.mock('./roleRoomAgentService', () => ({
  roleRoomAgentDefaultHeaders: () => ({ Authorization: 'Bearer test-session' }),
}));

describe('locationManagerService media', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uploads a scout photo as authenticated multipart without overriding its content type', async () => {
    const media = {
      id: 'file-1', projectId: 'troll project', locationId: 'forest/1', uploadedBy: 'user-1',
      displayName: 'scout.jpg', contentType: 'image/jpeg', sizeBytes: 3, checksumSha256: 'a'.repeat(64), createdAt: '2026-09-13T12:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ media }) });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'scout.jpg', { type: 'image/jpeg' });

    await expect(locationManagerService.uploadPhoto('troll project', 'forest/1', file)).resolves.toEqual(media);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/projects/troll%20project/locations/forest%2F1/media',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: 'Bearer test-session' },
        body: expect.any(FormData),
      }),
    );
  });
});
