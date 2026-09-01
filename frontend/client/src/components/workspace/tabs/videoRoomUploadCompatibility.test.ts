import { describe, expect, it, vi } from 'vitest';

import { getStoredAuthToken } from '@/lib/queryClient';
import {
  applyLegacyVideoUploadAuth,
  uploadVideoVersionWithCompatibility,
} from './videoRoomUploadCompatibility';

const prepared = { id: 'version-1', uploadUrl: 'https://uploads.example.test/video' };

function createOptions() {
  return {
    prepareDirectUpload: vi.fn().mockResolvedValue(prepared),
    uploadDirect: vi.fn().mockResolvedValue(undefined),
    confirmDirectUpload: vi.fn().mockResolvedValue(undefined),
    uploadLegacy: vi.fn().mockResolvedValue(undefined),
  };
}

describe('uploadVideoVersionWithCompatibility', () => {
  it('uses and confirms the direct upload when the new backend route exists', async () => {
    const options = createOptions();

    await expect(uploadVideoVersionWithCompatibility(options)).resolves.toBe('direct');

    expect(options.uploadDirect).toHaveBeenCalledWith(prepared);
    expect(options.confirmDirectUpload).toHaveBeenCalledWith(prepared);
    expect(options.uploadLegacy).not.toHaveBeenCalled();
  });

  it('falls back only when the initial direct-upload route returns status 404', async () => {
    const options = createOptions();
    const missingRoute = Object.assign(new Error('route missing'), { status: 404 });
    options.prepareDirectUpload.mockRejectedValue(missingRoute);

    await expect(uploadVideoVersionWithCompatibility(options)).resolves.toBe('legacy');

    expect(options.uploadLegacy).toHaveBeenCalledOnce();
    expect(options.uploadDirect).not.toHaveBeenCalled();
    expect(options.confirmDirectUpload).not.toHaveBeenCalled();
  });

  it.each([
    Object.assign(new Error('404 text without a status'), { status: undefined }),
    Object.assign(new Error('unauthorized'), { status: 401 }),
    Object.assign(new Error('backend failed'), { status: 500 }),
  ])('does not mask a non-404 prepare failure', async (failure) => {
    const options = createOptions();
    options.prepareDirectUpload.mockRejectedValue(failure);

    await expect(uploadVideoVersionWithCompatibility(options)).rejects.toBe(failure);
    expect(options.uploadLegacy).not.toHaveBeenCalled();
  });

  it('never falls back after bytes were sent through the direct path', async () => {
    const options = createOptions();
    const missingConfirmation = Object.assign(new Error('version missing'), { status: 404 });
    options.confirmDirectUpload.mockRejectedValue(missingConfirmation);

    await expect(uploadVideoVersionWithCompatibility(options)).rejects.toBe(missingConfirmation);

    expect(options.uploadDirect).toHaveBeenCalledWith(prepared);
    expect(options.uploadLegacy).not.toHaveBeenCalled();
  });
});

describe('legacy video upload authentication', () => {
  it('uses a Role Room-only token without requiring browser storage or XHR', () => {
    const storage = {
      getItem: vi.fn((key: string) => key === 'role_room_auth_token' ? ' role-room-session ' : null),
    };
    const headers = new Map<string, string>();
    const request = {
      withCredentials: false,
      setRequestHeader: vi.fn((name: string, value: string) => headers.set(name, value)),
    };

    applyLegacyVideoUploadAuth(request, getStoredAuthToken(storage));

    expect(storage.getItem).toHaveBeenNthCalledWith(1, 'creatorhub_auth_token');
    expect(storage.getItem).toHaveBeenNthCalledWith(2, 'role_room_auth_token');
    expect(request.withCredentials).toBe(true);
    expect(headers.get('Authorization')).toBe('Bearer role-room-session');
  });
});
