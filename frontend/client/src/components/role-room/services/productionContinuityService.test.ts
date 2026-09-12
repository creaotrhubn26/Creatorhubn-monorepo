import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductionContinuityOperations } from '../models/casting';
import type { ProductionContinuityConflictError } from './productionContinuityService';
import {
  productionContinuityService,
} from './productionContinuityService';

vi.mock('./roleRoomAgentService', () => ({
  roleRoomAgentDefaultHeaders: () => ({ Authorization: 'Bearer test-session' }),
}));

const operations: ProductionContinuityOperations = {
  sceneRecords: [{ sceneId: 'scene-1', status: 'in_progress' }],
  takes: [], entries: [], deviations: [], comments: [], revisions: [], activity: [],
};

describe('productionContinuityService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends an authenticated versioned patch to the isolated continuity endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ productionDay: { id: 'day/1', scenes: ['scene-1'], crew: [], props: [], continuityVersion: 5 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await productionContinuityService.save('troll project', 'day/1', 4, operations);

    expect(result.continuityVersion).toBe(5);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/projects/troll%20project/production-days/day%2F1/continuity',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer test-session' }),
        body: JSON.stringify({ expectedVersion: 4, operations }),
      }),
    );
  });

  it('uses the comment-only endpoint for director and AD feedback', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ productionDay: { id: 'day-1', scenes: ['scene-1'], crew: [], props: [], continuityVersion: 2 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await productionContinuityService.addComment('troll', 'day-1', 1, {
      sceneId: 'scene-1', message: 'Sjekk håndplassering.',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/projects/troll/production-days/day-1/continuity/comments',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('exposes the latest server day on a conflict without discarding the caller draft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'Konflikt', productionDay: { id: 'day-1', scenes: [], crew: [], props: [], continuityVersion: 8 } }),
    }));

    await expect(productionContinuityService.save('troll', 'day-1', 7, operations))
      .rejects.toEqual(expect.objectContaining<Partial<ProductionContinuityConflictError>>({
        name: 'ProductionContinuityConflictError',
        productionDay: expect.objectContaining({ continuityVersion: 8 }),
      }));
  });

  it('uploads continuity media as authenticated multipart without overriding its content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ reference: { id: 'file-1', storageFileId: 'file-1', storageProvider: 'aws_s3', kind: 'photo', label: 'lykt.jpg' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'lykt.jpg', { type: 'image/jpeg' });

    const reference = await productionContinuityService.uploadMedia('troll project', 'day/1', 'scene-1', file);

    expect(reference.kind).toBe('photo');
    expect(reference.storageProvider).toBe('aws_s3');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/projects/troll%20project/production-days/day%2F1/continuity/media',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer test-session' },
        body: expect.any(FormData),
      }),
    );
    expect((fetchMock.mock.calls[0][1].body as FormData).get('sceneId')).toBe('scene-1');
  });

  it('resolves private media through an authenticated short-lived URL request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://signed.example.test/file', contentType: 'image/jpeg' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(productionContinuityService.getMediaUrl('troll', 'day-1', 'file/1')).resolves.toEqual({
      url: 'https://signed.example.test/file',
      contentType: 'image/jpeg',
      displayName: undefined,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/projects/troll/production-days/day-1/continuity/media/file%2F1/url',
      expect.objectContaining({ headers: { Authorization: 'Bearer test-session' } }),
    );
  });
});
